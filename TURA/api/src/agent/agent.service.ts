import Anthropic from '@anthropic-ai/sdk';
import { previewResult, type ToolAudit, type TurnAudit } from '../audit/audit-log.js';
import type { Session } from '../auth.js';
import { config } from '../config.js';
import { PosApiError } from '../pos/pos-client.js';
import { toolsFor } from '../tools/registry.js';
import { atBranch } from '../tools/inventory-shared.js';
import { ToolRefusedError, type AssistantTool } from '../tools/types.js';
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
  /** A change TURA made in the POS, as it was left: shown to the user besides what TURA says. */
  | { type: 'change'; message: string }
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
}: TurnInput): Promise<void> {
  const messages: Anthropic.MessageParam[] = recentHistory(history);
  const system = buildSystemPrompt(session, mode);
  const definitions = tools.map((tool) => tool.definition);

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
        calls.map((call) => runTool(call, tools, session, audit, emit)),
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
      // Made right away, as the user who asked; the tool checks it first and the POS authorizes it.
      const done = await tool.run(input.value, { session });
      const message = atBranch(session, done.message, done.branchId);
      emit({ type: 'change', message });
      entry.ok = true;
      entry.ms = Date.now() - startedAt;
      entry.result = previewResult(message);
      return { type: 'tool_result', tool_use_id: call.id, content: `Hecho. ${message}` };
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
