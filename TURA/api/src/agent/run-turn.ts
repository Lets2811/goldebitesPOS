import Anthropic from '@anthropic-ai/sdk';
import type { Session } from '../auth.js';
import { config } from '../config.js';
import { buildSystemPrompt, type ConversationMode } from './system-prompt.js';
import { buildTools } from './tools.js';
import type { TurnMeter } from '../usage/usage-log.js';

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
  | { type: 'done' };

/** Resolves credentials from the environment (ANTHROPIC_API_KEY). */
const anthropic = new Anthropic();

/** Upper bound on model round-trips in one turn, so a confused turn cannot loop on tool calls. */
const MAX_ITERATIONS = 8;

export class TuraDeclinedError extends Error {}

/**
 * Answers the last user message in `history`, calling POS tools as needed and
 * emitting events as the answer is produced. `isCancelled` lets the caller
 * stop paying for a turn nobody is listening to any more. What the turn used
 * is written to `meter` as it goes, so it is known even if the turn fails.
 */
export async function runTurn(
  session: Session,
  history: ChatTurn[],
  mode: ConversationMode,
  meter: TurnMeter,
  emit: (event: TuraEvent) => void,
  isCancelled: () => boolean,
): Promise<void> {
  const runner = anthropic.beta.messages.toolRunner({
    model: config.model,
    max_tokens: 16000,
    system: buildSystemPrompt(session, mode),
    tools: buildTools(session),
    messages: history,
    output_config: { effort: config.effort },
    // If a safety classifier declines the request, the API retries it on the
    // model Anthropic recommends for that case instead of returning a refusal.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    max_iterations: MAX_ITERATIONS,
    stream: true,
  });

  for await (const messageStream of runner) {
    for await (const event of messageStream) {
      if (isCancelled()) {
        messageStream.abort();
        return;
      }
      if (
        event.type === 'content_block_start' &&
        event.content_block.type === 'tool_use'
      ) {
        meter.tools.push(event.content_block.name);
        emit({ type: 'tool', name: event.content_block.name });
      } else if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        meter.firstTextAt ??= Date.now();
        emit({ type: 'text', delta: event.delta.text });
      }
    }

    const message = await messageStream.finalMessage();
    // The model that answered, which is not always the one asked for: a
    // declined request is retried on a fallback.
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
  }

  emit({ type: 'done' });
}
