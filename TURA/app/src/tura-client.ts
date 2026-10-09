import { isAiSimulated } from './AiModeBadge';
import { getAccessToken } from './link';

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

/** Events streamed by TURA/api while it answers (see TuraEvent there). */
export type TuraEvent =
  | { type: 'text'; delta: string }
  | { type: 'tool'; name: string }
  | { type: 'done' }
  | { type: 'error'; message: string };

/** See ConversationMode in TURA/api: typed in the chat, or spoken and heard. */
export type ConversationMode = 'chat' | 'voice';

/** This app is not linked to a business (or its link was revoked in the POS). */
export class NotLinkedError extends Error {}

function postChat(
  messages: ChatTurn[],
  mode: ConversationMode,
  accessToken: string | null,
  signal: AbortSignal,
): Promise<Response> {
  return fetch('/tura/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({ messages, mode }),
    signal,
  });
}

/**
 * Sends the conversation to TURA and yields its answer as it is produced.
 * An expired access token is renewed once, transparently. While the service
 * simulates the AI it answers anyone, so an app that is not linked yet can
 * still be tried.
 */
export async function* streamChat(
  messages: ChatTurn[],
  signal: AbortSignal,
  mode: ConversationMode = 'chat',
): AsyncGenerator<TuraEvent> {
  let accessToken = await getAccessToken();
  if (!accessToken && !isAiSimulated()) {
    throw new NotLinkedError();
  }

  let response = await postChat(messages, mode, accessToken, signal);
  if (response.status === 401) {
    accessToken = await getAccessToken(true);
    if (!accessToken) {
      throw new NotLinkedError();
    }
    response = await postChat(messages, mode, accessToken, signal);
  }

  if (!response.ok || !response.body) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.message ?? 'TURA no está disponible en este momento.');
  }

  // Server-sent events: each event is a `data: <json>` line followed by a blank line.
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) {
      return;
    }
    buffer += value;

    let boundary: number;
    while ((boundary = buffer.indexOf('\n\n')) !== -1) {
      const line = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      if (line.startsWith('data: ')) {
        yield JSON.parse(line.slice(6)) as TuraEvent;
      }
    }
  }
}
