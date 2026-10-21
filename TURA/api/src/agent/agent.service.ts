import Anthropic from '@anthropic-ai/sdk';
import { previewResult, type ToolAudit, type TurnAudit } from '../audit/audit-log.js';
import type { Session } from '../auth.js';
import { config } from '../config.js';
import { PosApiError } from '../pos/pos-client.js';
import { toolsFor } from '../tools/registry.js';
import { ToolRefusedError, type AssistantTool, type PendingActionStore } from '../tools/types.js';
import { PENDING_ACTION_TTL_MS, pendingActions } from './pending-actions.js';
import { commitAction } from './commit-action.js';
import type { TurnMeter } from '../usage/usage-log.js';
import { buildSystemPrompt, type ConversationMode } from './system-prompt.js';

/** One prior turn of the conversation, as the client keeps it: plain text only. */
export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * What a client receives while TURA answers. Deliberately not tied to any UI:
 * the PWA renders these today, a native app or the voice layer can consume
 * the same stream later.
 */
export type TuraEvent =
  | { type: 'text'; delta: string }
  | { type: 'tool'; name: string }
  /** A change TURA prepared: confirmed by the user's next answer, or with its buttons (see /tura/actions). */
  | { type: 'confirm'; action: { id: string; summary: string; expiresAt: string } }
  /** A prepared change the user confirmed or cancelled in the conversation. */
  | {
      type: 'settled';
      id: string;
      outcome: { state: 'done' | 'failed'; message: string } | { state: 'cancelled' };
    }
  | { type: 'done' };

/** The model declined to answer (a safety classifier stopped the request). */
export class TuraDeclinedError extends Error {}

/** The answer hit the response ceiling before saying anything usable. */
export class TuraTruncatedError extends Error {}

/** One streamed response of the model: its events as they arrive, then the whole message. */
export interface ModelStream extends AsyncIterable<Anthropic.MessageStreamEvent> {
  finalMessage(): Promise<Anthropic.Message>;
  abort(): void;
}

/** The one thing the agent needs from the Claude API. Tests hand it a scripted one. */
export interface ModelClient {
  stream(params: Anthropic.MessageStreamParams): ModelStream;
}

let defaultClient: ModelClient | undefined;

/**
 * The real client. Credentials come from the environment (ANTHROPIC_API_KEY).
 * The SDK already retries a request, waiting longer each time, on rate
 * limits, 5xx and connection errors — so the retry policy is its settings,
 * not a second loop around it.
 */
function claude(): ModelClient {
  if (!defaultClient) {
    const anthropic = new Anthropic({
      timeout: config.claudeTimeoutMs,
      maxRetries: config.claudeMaxRetries,
    });
    defaultClient = { stream: (params) => anthropic.messages.stream(params) };
  }
  return defaultClient;
}

/** Said instead of an answer when the turn used up its tool rounds without finishing. */
export const LIMIT_REACHED_MESSAGE =
  'No logré terminar esa consulta: necesité demasiados pasos. Intenta con una pregunta más concreta.';

/** A tool result this long is cut before it reaches the model: no endpoint should need more. */
const MAX_RESULT_CHARS = 20_000;

/**
 * The part of the conversation the model sees: the user's latest `turns`
 * messages and the answers between them. The client owns the history and
 * sends all of it; this is what keeps a long chat from growing every request.
 */
export function recentHistory(history: ChatTurn[], turns = config.historyTurns): ChatTurn[] {
  let seen = 0;
  for (let index = history.length - 1; index >= 0; index--) {
    if (history[index].role === 'user' && ++seen === turns) {
      return history.slice(index);
    }
  }
  // Fewer user messages than the limit: everything, from the first one the user sent.
  const first = history.findIndex((turn) => turn.role === 'user');
  return first === -1 ? [] : history.slice(first);
}

export interface TurnInput {
  session: Session;
  /** The conversation so far, ending with the message to answer. */
  history: ChatTurn[];
  mode: ConversationMode;
  /** Filled in with what the turn used, for the usage log. */
  meter: TurnMeter;
  /** Filled in with what the turn did, for the audit log. */
  audit: TurnAudit;
  emit: (event: TuraEvent) => void;
  /** Lets the caller stop paying for a turn nobody is listening to any more. */
  isCancelled: () => boolean;
  model?: ModelClient;
  tools?: AssistantTool[];
  /** Where prepared changes wait for the user's confirmation. */
  actions?: PendingActionStore;
}

/**
 * Answers the last user message: asks the model, runs the POS tools it calls,
 * hands their results back, and repeats until the model answers or the turn
 * runs out of rounds. Text is emitted as it is produced. What the turn used
 * and did is written to `meter` and `audit` as it goes, so it is known even
 * if the turn fails halfway.
 */
export async function runTurn({
  session,
  history,
  mode,
  meter,
  audit,
  emit,
  isCancelled,
  model = claude(),
  tools = toolsFor(session),
  actions = pendingActions,
}: TurnInput): Promise<void> {
  const messages: Anthropic.MessageParam[] = recentHistory(history);
  const system = buildSystemPrompt(session, mode);
  // Whoever can make changes can also answer, in the conversation, the ones TURA asked them about.
  const canChange = tools.some((tool) => tool.kind === 'write');
  const definitions = [
    ...tools.map((tool) => tool.definition),
    ...(canChange ? ANSWER_TOOLS : []),
  ];
  const turn = { userId: session.userId ?? 'anonymous', number: 0 };
  if (canChange) {
    turn.number = await actions.beginTurn(turn.userId);
  }

  for (let iteration = 1; iteration <= config.maxToolIterations; iteration++) {
    audit.iterations = iteration;
    const stream = model.stream({
      model: config.model,
      max_tokens: config.maxTokens,
      system,
      tools: definitions,
      messages,
      output_config: { effort: config.effort },
    });

    let wroteText = false;
    for await (const event of stream) {
      if (isCancelled()) {
        stream.abort();
        return;
      }
      if (event.type === 'content_block_start' && event.content_block.type === 'tool_use') {
        meter.tools.push(event.content_block.name);
        emit({ type: 'tool', name: event.content_block.name });
      } else if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        meter.firstTextAt ??= Date.now();
        wroteText = true;
        emit({ type: 'text', delta: event.delta.text });
      }
    }

    const message = await stream.finalMessage();
    meter.calls.push({
      model: message.model,
      input: message.usage.input_tokens,
      output: message.usage.output_tokens,
      cacheRead: message.usage.cache_read_input_tokens ?? 0,
      cacheWrite: message.usage.cache_creation_input_tokens ?? 0,
    });

    if (message.stop_reason === 'refusal') {
      throw new TuraDeclinedError();
    }

    const calls = message.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
    );

    if (message.stop_reason === 'max_tokens') {
      // A tool call cut off here has incomplete input, and a turn with no
      // text at all spent the whole ceiling thinking: neither is an answer.
      // Text that was cut short was already shown; it stands as the answer.
      if (calls.length > 0 || !wroteText) {
        throw new TuraTruncatedError();
      }
      break;
    }

    if (message.stop_reason !== 'tool_use' || calls.length === 0) {
      break;
    }

    if (iteration === config.maxToolIterations) {
      audit.limitReached = true;
      emit({ type: 'text', delta: `${wroteText ? '\n\n' : ''}${LIMIT_REACHED_MESSAGE}` });
      break;
    }

    // The whole content goes back, not just the calls: it carries the model's
    // thinking, which has to be returned exactly as it came.
    messages.push({ role: 'assistant', content: message.content });
    // Every result of the round in one user message, in the order of the calls.
    messages.push({
      role: 'user',
      content: await Promise.all(
        calls.map((call) =>
          ANSWER_TOOL_NAMES.has(call.name)
            ? answerPendingChanges(call, tools, session, audit, emit, actions, turn)
            : runTool(call, tools, session, audit, emit, actions, turn),
        ),
      ),
    });
  }

  emit({ type: 'done' });
}

/**
 * Runs one tool call and reports it to the model. Nothing a tool does can
 * break the turn: a bad input, a refusal from the POS or a bug all come back
 * as an error result, which the model then explains to the user.
 */
async function runTool(
  call: Anthropic.ToolUseBlock,
  tools: AssistantTool[],
  session: Session,
  audit: TurnAudit,
  emit: (event: TuraEvent) => void,
  actions: PendingActionStore,
  turn: { userId: string; number: number },
): Promise<Anthropic.ToolResultBlockParam> {
  const startedAt = Date.now();
  const entry: ToolAudit = { name: call.name, input: call.input, ok: false, ms: 0 };
  audit.tools.push(entry);

  const fail = (error: string): Anthropic.ToolResultBlockParam => {
    entry.error = error;
    entry.ms = Date.now() - startedAt;
    return { type: 'tool_result', tool_use_id: call.id, content: error, is_error: true };
  };

  const tool = tools.find((candidate) => candidate.definition.name === call.name);
  if (!tool) {
    return fail(`La herramienta "${call.name}" no existe o no está disponible para este usuario.`);
  }
  const input = tool.parse(call.input);
  if (!input.ok) {
    return fail(`Parámetros inválidos: ${input.error}`);
  }

  try {
    if (tool.kind === 'write') {
      // The model's call only prepares the change, with the input checked
      // here: it waits for the user's answer in their next message.
      const { summary } = await tool.prepare(input.value, { session });
      const action = await actions.create({
        tool: tool.definition.name,
        summary,
        input: input.value,
        userId: turn.userId,
        turn: turn.number,
        expiresAt: new Date(Date.now() + PENDING_ACTION_TTL_MS).toISOString(),
      });
      emit({ type: 'confirm', action: { id: action.id, summary, expiresAt: action.expiresAt } });
      const content =
        `Cambio preparado, todavía NO hecho: ${summary} Dile al usuario en una frase qué va a pasar y ` +
        'pregúntale si lo haces. Termina ahí tu respuesta: solo si en su siguiente mensaje dice que sí, ' +
        'llama confirmar_cambios; si dice que no, cancelar_cambios. No digas que ya quedó hecho.';
      entry.ok = true;
      entry.ms = Date.now() - startedAt;
      entry.result = previewResult(`[pendiente ${action.id}] ${summary}`);
      return { type: 'tool_result', tool_use_id: call.id, content };
    }
    const content = JSON.stringify(await tool.execute(input.value, { session }));
    entry.ok = true;
    entry.ms = Date.now() - startedAt;
    entry.result = previewResult(content);
    return {
      type: 'tool_result',
      tool_use_id: call.id,
      content:
        content.length > MAX_RESULT_CHARS
          ? `${content.slice(0, MAX_RESULT_CHARS)}… (resultado recortado: pide menos datos)`
          : content,
    };
  } catch (error) {
    if (error instanceof PosApiError) {
      return fail(`El POS respondió con un error (${error.status}): ${error.message}`);
    }
    if (error instanceof ToolRefusedError) {
      return fail(error.message);
    }
    console.error(`Tool ${call.name} failed unexpectedly`, error);
    return fail('Ocurrió un error interno al ejecutar la herramienta.');
  }
}

/**
 * The user's answer to the changes TURA asked about in its previous reply:
 * yes (they are made now) or no. Not POS tools: they act on what is pending
 * here, and only on what was prepared in the user's previous turn — never
 * on a change prepared in this same turn, which the user has not heard yet.
 */
const ANSWER_TOOLS: Anthropic.Tool[] = [
  {
    name: 'confirmar_cambios',
    description:
      'Hace los cambios que preparaste en tu respuesta anterior y que el usuario acaba de aceptar. Úsala ' +
      'solo si su último mensaje los acepta claramente ("sí", "dale", "hazlo", "confirmo"). Si duda, pide ' +
      'algo distinto o no responde a la pregunta, no la uses. Hace todos los que preparaste esa vez.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'cancelar_cambios',
    description:
      'Descarta los cambios que preparaste en tu respuesta anterior, cuando el usuario dice que no o que ' +
      'ya no los quiere.',
    input_schema: { type: 'object', properties: {} },
  },
];
const ANSWER_TOOL_NAMES = new Set(ANSWER_TOOLS.map((tool) => tool.name));

async function answerPendingChanges(
  call: Anthropic.ToolUseBlock,
  tools: AssistantTool[],
  session: Session,
  audit: TurnAudit,
  emit: (event: TuraEvent) => void,
  actions: PendingActionStore,
  turn: { userId: string; number: number },
): Promise<Anthropic.ToolResultBlockParam> {
  const startedAt = Date.now();
  const entry: ToolAudit = { name: call.name, input: call.input, ok: false, ms: 0 };
  audit.tools.push(entry);
  const pending = await actions.takeFromTurn(turn.userId, turn.number - 1);

  if (pending.length === 0) {
    entry.error = 'nothing pending';
    entry.ms = Date.now() - startedAt;
    return {
      type: 'tool_result',
      tool_use_id: call.id,
      content:
        'No hay cambios esperando respuesta: ya se hicieron o cancelaron, vencieron (duran 10 minutos) o ' +
        'no los preparaste en tu respuesta anterior. Si el usuario aún quiere el cambio, prepáralo de nuevo.',
      is_error: true,
    };
  }

  if (call.name === 'cancelar_cambios') {
    for (const action of pending) {
      emit({ type: 'settled', id: action.id, outcome: { state: 'cancelled' } });
    }
    entry.ok = true;
    entry.ms = Date.now() - startedAt;
    entry.result = previewResult(pending.map((action) => `Cancelado: ${action.summary}`).join(' '));
    return {
      type: 'tool_result',
      tool_use_id: call.id,
      content: `Cancelado, no se hizo nada: ${pending.map((action) => action.summary).join(' ')}`,
    };
  }

  // One after another: two changes to the same item must not race.
  const results: string[] = [];
  let failed = false;
  for (const action of pending) {
    const outcome = await commitAction(action, session, tools);
    emit({
      type: 'settled',
      id: action.id,
      outcome: { state: outcome.ok ? 'done' : 'failed', message: outcome.message },
    });
    results.push(outcome.ok ? `Hecho: ${outcome.message}` : `No se hizo (${action.summary}): ${outcome.message}`);
    failed ||= !outcome.ok;
  }
  entry.ok = !failed;
  entry.ms = Date.now() - startedAt;
  entry.result = previewResult(results.join(' '));
  if (failed) {
    entry.error = results.filter((result) => result.startsWith('No se hizo')).join(' ');
  }
  return { type: 'tool_result', tool_use_id: call.id, content: results.join('\n') };
}
