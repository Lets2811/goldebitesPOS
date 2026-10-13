import 'dotenv/config';
import { fileURLToPath } from 'node:url';

const EFFORT_LEVELS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;
export type Effort = (typeof EFFORT_LEVELS)[number];

function readEffort(): Effort {
  const value = process.env.TURA_EFFORT ?? 'low';
  if (!EFFORT_LEVELS.includes(value as Effort)) {
    throw new Error(
      `TURA_EFFORT must be one of ${EFFORT_LEVELS.join(', ')} (got "${value}")`,
    );
  }
  return value as Effort;
}

function readPositiveInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') {
    return fallback;
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive whole number (got "${raw}")`);
  }
  return value;
}

const POS_TARGETS = ['local', 'prod'] as const;
type PosTarget = (typeof POS_TARGETS)[number];

/**
 * Which POS this service talks to. POS_API_TARGET picks between the two
 * addresses, so switching is one word and neither address has to be retyped.
 */
function readPos(): { target: PosTarget; url: string } {
  const target = (process.env.POS_API_TARGET ?? 'local') as PosTarget;
  if (!POS_TARGETS.includes(target)) {
    throw new Error(
      `POS_API_TARGET must be one of ${POS_TARGETS.join(', ')} (got "${target}")`,
    );
  }
  const url =
    target === 'prod'
      ? process.env.POS_API_URL_PROD
      : (process.env.POS_API_URL_LOCAL ?? 'http://localhost:3000/api/v1');
  if (!url) {
    throw new Error('POS_API_TARGET is "prod" but POS_API_URL_PROD is not set');
  }
  return { target, url: url.replace(/\/+$/, '') };
}

const pos = readPos();

function dataFile(name: string): string {
  return fileURLToPath(new URL(`../data/${name}`, import.meta.url));
}

export const config = {
  port: parseInt(process.env.PORT ?? '3100', 10),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5174',
  // Base URL of the POS API (GB-BE), including its global prefix, and which of the two it is.
  posApiTarget: pos.target,
  posApiUrl: pos.url,
  // A POS access token used for requests that bring none, so the assistant can
  // be tried for real before the app is linked. Development only: it makes
  // every unlinked visitor act as that user, so it is ignored in production.
  devPosToken:
    process.env.NODE_ENV === 'production' ? '' : (process.env.TURA_DEV_POS_TOKEN ?? '').trim(),
  // How long one request to the POS may take before the tool reports it as failed.
  posTimeoutMs: readPositiveInt('POS_API_TIMEOUT_MS', 15_000),
  // Opens /tura/admin to whoever presents this key. With none, there is no admin API.
  adminKey: process.env.TURA_ADMIN_KEY ?? '',
  // Where each turn's token usage is appended, one JSON object per line.
  usageLogPath: process.env.TURA_USAGE_LOG ?? dataFile('usage.jsonl'),
  // Where each message's audit record is appended: who asked, which tools ran and what they returned.
  auditLogPath: process.env.TURA_AUDIT_LOG ?? dataFile('audit.jsonl'),
  // Answers with canned replies instead of calling Claude, to work on the
  // interface without spending. See agent/simulated-turn.ts.
  simulateAi: process.env.TURA_SIMULATE_AI === 'true',
  model: process.env.TURA_MODEL ?? 'claude-haiku-5-5',
  effort: readEffort(),
  // Ceiling of one model response. The model's thinking counts against it too.
  maxTokens: readPositiveInt('TURA_MAX_TOKENS', 1024),
  // One request to Claude: how long it may take, and how many times the SDK retries it (with backoff) on 429, 5xx and network errors.
  claudeTimeoutMs: readPositiveInt('TURA_CLAUDE_TIMEOUT_MS', 30_000),
  claudeMaxRetries: readPositiveInt('TURA_CLAUDE_MAX_RETRIES', 2),
  // How much of the conversation the model sees: this many of the user's latest messages, with the answers between them.
  historyTurns: readPositiveInt('TURA_HISTORY_TURNS', 10),
  // Upper bound on model round-trips for one message, so a confused turn cannot loop on tool calls.
  maxToolIterations: readPositiveInt('TURA_MAX_TOOL_ITERATIONS', 6),
  timezone: process.env.TURA_TIMEZONE ?? 'America/Bogota',
};
