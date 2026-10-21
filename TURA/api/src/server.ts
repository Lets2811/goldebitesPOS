import { timingSafeEqual } from 'node:crypto';
import Anthropic from '@anthropic-ai/sdk';
import cors from 'cors';
import express, { type Request, type Response } from 'express';
import { z } from 'zod';
import {
  runTurn,
  TuraDeclinedError,
  TuraTruncatedError,
  type TuraEvent,
} from './agent/agent.service.js';
import { runSimulatedTurn } from './agent/simulated-turn.js';
import { pendingActions } from './agent/pending-actions.js';
import { commitAction } from './agent/commit-action.js';
import { newAudit, recordAudit } from './audit/audit-log.js';
import { authenticate, UnauthenticatedError, type Session } from './auth.js';
import { config } from './config.js';
import { PosApiError } from './pos/pos-client.js';
import { newMeter, recordTurn, summarizeUsage, type TurnRecord } from './usage/usage-log.js';

const chatRequestSchema = z.object({
  mode: z.enum(['chat', 'voice']).default('chat'),
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().trim().min(1).max(4000),
      }),
    )
    .min(1)
    .max(40)
    .refine((messages) => messages.at(-1)?.role === 'user', {
      message: 'The last message must be from the user',
    }),
});

/** Message shown to the user for a failure mid-answer; details stay in the server log. */
function describeFailure(error: unknown): string {
  if (error instanceof TuraDeclinedError) {
    return 'No puedo ayudarte con esa solicitud.';
  }
  if (error instanceof TuraTruncatedError) {
    return 'La respuesta quedó incompleta. Intenta de nuevo con una pregunta más corta.';
  }
  if (error instanceof Anthropic.AuthenticationError) {
    return 'TURA no está configurada: falta la credencial del modelo en el servidor.';
  }
  if (error instanceof Anthropic.RateLimitError) {
    return 'TURA está recibiendo muchas consultas. Intenta de nuevo en un momento.';
  }
  if (error instanceof Anthropic.APIConnectionTimeoutError) {
    return 'TURA tardó demasiado en responder. Intenta de nuevo en un momento.';
  }
  if (error instanceof PosApiError) {
    return 'No pude conectarme con el POS. Intenta de nuevo en un momento.';
  }
  return 'Ocurrió un error al responder. Intenta de nuevo.';
}

function sendEvent(res: Response, event: TuraEvent | { type: 'error'; message: string }): void {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

const app = express();

app.use(cors({ origin: config.corsOrigin.split(',') }));
app.use(express.json({ limit: '200kb' }));

app.get('/tura/health', (_req, res) => {
  res.json({
    status: 'ok',
    simulated: config.simulateAi,
    // False when this service answers without the app being linked: while the
    // AI is simulated, or when a development token stands in for the user.
    linkRequired: !config.simulateAi && !config.devPosToken,
    pos: config.posApiTarget,
  });
});

/**
 * One conversational turn. The client sends the text history (it owns the
 * conversation; this service keeps no state — the agent reads only its most
 * recent turns) and receives the answer as a stream of server-sent events —
 * see TuraEvent.
 */
/** The caller, or null once a response explaining why not was sent. */
async function authenticateOrReply(req: Request, res: Response): Promise<Session | null> {
  try {
    return await authenticate(req);
  } catch (error) {
    if (error instanceof UnauthenticatedError) {
      res.status(401).json({ message: 'No autenticado' });
    } else if (error instanceof PosApiError) {
      // 401/403 from the POS are the caller's to act on (refresh the token,
      // change the password); anything else means the POS is unavailable.
      const status = error.status === 401 || error.status === 403 ? error.status : 502;
      res.status(status).json({ message: error.message });
    } else {
      console.error('Authentication failed unexpectedly', error);
      res.status(500).json({ message: 'Error interno' });
    }
    return null;
  }
}

app.post('/tura/chat', async (req, res) => {
  const parsed = chatRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'Solicitud inválida' });
    return;
  }

  const session = await authenticateOrReply(req, res);
  if (!session) {
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    // Tells nginx not to buffer the stream when this runs behind it.
    'X-Accel-Buffering': 'no',
  });

  let clientGone = false;
  res.on('close', () => {
    clientGone = true;
  });

  const startedAt = Date.now();
  const meter = newMeter();
  const audit = newAudit();
  let outcome: TurnRecord['outcome'] = 'ok';
  let failure: string | undefined;

  try {
    const emit = (event: TuraEvent) => sendEvent(res, event);
    if (config.simulateAi) {
      await runSimulatedTurn(session, parsed.data.messages, emit, () => clientGone);
    } else {
      await runTurn({
        session,
        history: parsed.data.messages,
        mode: parsed.data.mode,
        meter,
        audit,
        emit,
        isCancelled: () => clientGone,
      });
    }
    if (clientGone) {
      outcome = 'cancelled';
    }
  } catch (error) {
    outcome = 'error';
    failure = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    console.error('Turn failed', error);
    if (!clientGone) {
      sendEvent(res, { type: 'error', message: describeFailure(error) });
    }
  } finally {
    res.end();
    // Failed and abandoned turns are logged too: they still cost what they used.
    recordTurn({
      at: new Date(startedAt).toISOString(),
      mode: parsed.data.mode,
      outcome,
      firstTextMs: meter.firstTextAt === null ? null : meter.firstTextAt - startedAt,
      totalMs: Date.now() - startedAt,
      tools: meter.tools,
      calls: meter.calls,
    }).catch((error: unknown) => console.error('Could not record usage', error));
    recordAudit({
      at: new Date(startedAt).toISOString(),
      userId: session.userId,
      businessId: session.businessId,
      branchId: session.branchId,
      role: session.roleName,
      mode: parsed.data.mode,
      message: parsed.data.messages.at(-1)?.content ?? '',
      outcome,
      error: failure,
      totalMs: Date.now() - startedAt,
      ...audit,
    }).catch((error: unknown) => console.error('Could not record audit', error));
  }
});

/**
 * The user confirms a change TURA prepared (see the 'confirm' event): it runs
 * now, as that user, with exactly the input it was prepared with. A change
 * runs once, only for the user it was prepared for, and only while that user
 * still has the permission it needs.
 */
app.post('/tura/actions/:id/confirm', async (req, res) => {
  const session = await authenticateOrReply(req, res);
  if (!session) {
    return;
  }
  const action = await pendingActions.take(String(req.params.id), session.userId ?? 'anonymous');
  if (!action) {
    res.status(404).json({
      message: 'Este cambio ya no se puede confirmar: venció o ya se usó. Pídeselo de nuevo a TURA.',
    });
    return;
  }
  const startedAt = Date.now();
  const outcome = await commitAction(action, session);
  if (outcome.ok) {
    res.json({ message: outcome.message });
  } else {
    res.status(outcome.status).json({ message: outcome.message });
  }
  const message = outcome.ok ? outcome.message : '';
  const failure = outcome.ok ? undefined : outcome.failure;

  recordAudit({
    at: new Date(startedAt).toISOString(),
    userId: session.userId,
    businessId: session.businessId,
    branchId: session.branchId,
    role: session.roleName,
    mode: 'action',
    message: `Confirmó: ${action.summary}`,
    outcome: failure ? 'error' : 'ok',
    error: failure,
    totalMs: Date.now() - startedAt,
    iterations: 0,
    limitReached: false,
    tools: [
      {
        name: action.tool,
        input: action.input,
        ok: !failure,
        ms: Date.now() - startedAt,
        ...(failure ? { error: failure } : { result: message }),
      },
    ],
  }).catch((error: unknown) => console.error('Could not record audit', error));
});

/** The user cancels a change TURA prepared: it can no longer be confirmed. */
app.post('/tura/actions/:id/discard', async (req, res) => {
  const session = await authenticateOrReply(req, res);
  if (!session) {
    return;
  }
  await pendingActions.discard(String(req.params.id), session.userId ?? 'anonymous');
  res.status(204).end();
});

function isAdmin(header: string | undefined): boolean {
  const presented = Buffer.from(header?.startsWith('Bearer ') ? header.slice(7).trim() : '');
  const expected = Buffer.from(config.adminKey);
  return (
    expected.length > 0 && presented.length === expected.length && timingSafeEqual(presented, expected)
  );
}

/**
 * Usage and cost of the last `days` days, for the developer. Guarded by its own
 * key (TURA_ADMIN_KEY) rather than a POS role: what TURA costs to run is not
 * something the restaurant's staff should see.
 */
app.get('/tura/admin/usage', async (req, res) => {
  if (!config.adminKey) {
    res.status(404).json({ message: 'No disponible' });
    return;
  }
  if (!isAdmin(req.headers.authorization)) {
    res.status(401).json({ message: 'Clave de administración incorrecta' });
    return;
  }
  const days = z.coerce.number().int().min(1).max(365).catch(30).parse(req.query.days);
  try {
    res.json(await summarizeUsage(days));
  } catch (error) {
    console.error('Could not read usage', error);
    res.status(500).json({ message: 'No se pudo leer el registro de uso' });
  }
});

app.listen(config.port, () => {
  console.log(`TURA API running on http://localhost:${config.port}/tura`);
  console.log(`POS: ${config.posApiTarget} (${config.posApiUrl})`);
  if (config.devPosToken) {
    console.warn(
      'TURA_DEV_POS_TOKEN is set: requests without a token act as that POS user. Development only.',
    );
  }
  if (config.simulateAi) {
    console.warn('TURA_SIMULATE_AI is on: answers are canned and Claude is not called');
  } else if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    console.warn(
      'ANTHROPIC_API_KEY is not set: /tura/chat will fail until it is added to .env',
    );
  }
});
