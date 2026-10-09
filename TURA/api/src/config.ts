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

export const config = {
  port: parseInt(process.env.PORT ?? '3100', 10),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5174',
  posApiUrl: (process.env.POS_API_URL ?? 'http://localhost:3000/api/v1').replace(
    /\/+$/,
    '',
  ),
  // Opens /tura/admin to whoever presents this key. With none, there is no admin API.
  adminKey: process.env.TURA_ADMIN_KEY ?? '',
  // Where each turn's token usage is appended, one JSON object per line.
  usageLogPath:
    process.env.TURA_USAGE_LOG ?? fileURLToPath(new URL('../data/usage.jsonl', import.meta.url)),
  // Answers with canned replies instead of calling Claude, to work on the
  // interface without spending. See agent/simulated-turn.ts.
  simulateAi: process.env.TURA_SIMULATE_AI === 'true',
  model: process.env.TURA_MODEL ?? 'claude-opus-5-5',
  effort: readEffort(),
  timezone: process.env.TURA_TIMEZONE ?? 'America/Bogota',
};
