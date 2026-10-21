import type Anthropic from '@anthropic-ai/sdk';
import { mock } from 'node:test';
import type { ModelClient, ModelStream } from '../agent/agent.service.js';
import { NO_BRANCHES, type Session } from '../auth.js';
import { PosClient } from '../pos/pos-client.js';

/** A signed-in user as the agent sees one. Nothing here reaches a real POS: see mockPos. */
export function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    pos: new PosClient('user-access-token'),
    userId: 'user-1',
    businessId: 'business-1',
    firstName: 'Ana',
    businessName: 'Golden Bites',
    roleName: 'OWNER',
    branchId: 'branch-1',
    branches: NO_BRANCHES,
    permissions: ['products.read', 'inventory.read'],
    ...overrides,
  };
}

export interface PosRequest {
  url: URL;
  authorization: string | null;
  method: string;
  /** The JSON body sent, for writes. */
  body?: unknown;
}

/**
 * Replaces the network for one test: every request the POS client makes is
 * recorded and answered by `respond`. Returns the requests seen so far.
 */
export function mockPos(
  respond: (request: PosRequest) => { status?: number; body: unknown } | Error,
): PosRequest[] {
  const requests: PosRequest[] = [];
  mock.method(globalThis, 'fetch', async (input: URL | string, init?: RequestInit) => {
    const request: PosRequest = {
      url: new URL(String(input)),
      authorization: new Headers(init?.headers).get('authorization'),
      method: init?.method ?? 'GET',
      ...(typeof init?.body === 'string' && { body: JSON.parse(init.body) as unknown }),
    };
    requests.push(request);
    const answer = respond(request);
    if (answer instanceof Error) {
      throw answer;
    }
    return new Response(JSON.stringify(answer.body), {
      status: answer.status ?? 200,
      headers: { 'content-type': 'application/json' },
    });
  });
  return requests;
}

type ScriptedBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown };

export interface ScriptedResponse {
  content: ScriptedBlock[];
  stop_reason: Anthropic.Message['stop_reason'];
}

function toMessage(response: ScriptedResponse): Anthropic.Message {
  return {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model: 'claude-test',
    content: response.content,
    stop_reason: response.stop_reason,
    stop_sequence: null,
    usage: { input_tokens: 100, output_tokens: 20 },
  } as unknown as Anthropic.Message;
}

/** Just the events the agent reads: where a tool call starts, and text as it arrives. */
function* toEvents(response: ScriptedResponse): Generator<Anthropic.MessageStreamEvent> {
  for (const [index, block] of response.content.entries()) {
    if (block.type === 'tool_use') {
      yield { type: 'content_block_start', index, content_block: block } as never;
    } else {
      yield {
        type: 'content_block_delta',
        index,
        delta: { type: 'text_delta', text: block.text },
      } as never;
    }
  }
}

/**
 * Stands in for the Claude API: answers each request with the next scripted
 * response (the last one repeats), and keeps a copy of every request as it
 * was at the moment it was made.
 */
export function scriptedModel(responses: ScriptedResponse[]): {
  client: ModelClient;
  requests: Anthropic.MessageStreamParams[];
} {
  const requests: Anthropic.MessageStreamParams[] = [];
  const client: ModelClient = {
    stream(params): ModelStream {
      // The agent keeps appending to the same messages array; a copy is what this request saw.
      requests.push(structuredClone(params));
      const response = responses[Math.min(requests.length - 1, responses.length - 1)];
      return {
        async *[Symbol.asyncIterator]() {
          yield* toEvents(response);
        },
        finalMessage: async () => toMessage(response),
        abort: () => undefined,
      };
    },
  };
  return { client, requests };
}
