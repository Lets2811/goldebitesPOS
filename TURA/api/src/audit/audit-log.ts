import { appendFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { config } from '../config.js';

/** How much of a tool's result is kept. It is the business's data written to disk, so only enough to see what was answered from. */
const RESULT_PREVIEW_CHARS = 2000;

/** One tool call, as it happened. */
export interface ToolAudit {
  name: string;
  /** What the model asked for, as received — before validation, so a rejected input is visible too. */
  input: unknown;
  ok: boolean;
  ms: number;
  /** The start of what the tool returned to the model. */
  result?: string;
  /** Why it failed: invalid input, the POS's answer, or an internal error. */
  error?: string;
}

/** What the agent fills in while it answers one message. */
export interface TurnAudit {
  tools: ToolAudit[];
  /** Requests made to the model. */
  iterations: number;
  /** True when the turn was stopped for reaching the tool-loop limit. */
  limitReached: boolean;
}

export function newAudit(): TurnAudit {
  return { tools: [], iterations: 0, limitReached: false };
}

/** One message from a user and everything done to answer it: one JSON object per line of the log. */
export interface AuditRecord extends TurnAudit {
  at: string;
  userId: string | null;
  businessId: string | null;
  branchId: string | null;
  role: string;
  mode: string;
  /** The user's message. */
  message: string;
  outcome: 'ok' | 'error' | 'cancelled';
  /** Why the turn failed, when it did. */
  error?: string;
  totalMs: number;
}

export function previewResult(content: string): string {
  return content.length > RESULT_PREVIEW_CHARS
    ? `${content.slice(0, RESULT_PREVIEW_CHARS)}… (${content.length} caracteres)`
    : content;
}

export async function recordAudit(record: AuditRecord, path = config.auditLogPath): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, `${JSON.stringify(record)}\n`, 'utf-8');
}
