import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { config } from '../config.js';
import { COMPARABLE_MODELS, costOf, listPrice, type TokenCount } from './pricing.js';

/** One request to the model. A turn makes several when TURA calls tools. */
export interface ModelCall extends TokenCount {
  model: string;
}

/** What runTurn fills in while it answers, for the usage log. */
export interface TurnMeter {
  calls: ModelCall[];
  tools: string[];
  /** When the first piece of the answer was produced, as a Date.now() value. */
  firstTextAt: number | null;
}

export function newMeter(): TurnMeter {
  return { calls: [], tools: [], firstTextAt: null };
}

/** One conversational turn, as stored: one JSON object per line of the log. */
export interface TurnRecord {
  at: string;
  /** The business the turn was for; missing in records older than this field. */
  businessId?: string | null;
  mode: string;
  outcome: 'ok' | 'error' | 'cancelled';
  /** Milliseconds until the answer started and until it ended. */
  firstTextMs: number | null;
  totalMs: number;
  tools: string[];
  calls: ModelCall[];
}

export async function recordTurn(record: TurnRecord): Promise<void> {
  await mkdir(dirname(config.usageLogPath), { recursive: true });
  await appendFile(config.usageLogPath, `${JSON.stringify(record)}\n`, 'utf-8');
}

async function readTurns(since: Date): Promise<TurnRecord[]> {
  let content: string;
  try {
    content = await readFile(config.usageLogPath, 'utf-8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
  return content
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => JSON.parse(line) as TurnRecord)
    .filter((turn) => new Date(turn.at) >= since);
}

interface Group {
  key: string;
  turns: number;
  costUsd: number;
  inputTokens: number;
  outputTokens: number;
}

/** The key of turns with no business: recorded before it was kept, or without a session. */
export const UNKNOWN_BUSINESS = 'unknown';

function addTo(groups: Map<string, Group>, key: string, turns: number, call?: ModelCall): void {
  const group = groups.get(key) ?? { key, turns: 0, costUsd: 0, inputTokens: 0, outputTokens: 0 };
  group.turns += turns;
  if (call) {
    group.costUsd += costOf(call.model, call) ?? 0;
    group.inputTokens += call.input + call.cacheRead + call.cacheWrite;
    group.outputTokens += call.output;
  }
  groups.set(key, group);
}

function average(values: number[]): number | null {
  return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** The value below which `fraction` of the values fall, e.g. 0.9 for the slow end. */
function percentile(values: number[], fraction: number): number | null {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))];
}

const dayFormat = new Intl.DateTimeFormat('en-CA', { timeZone: config.timezone });
const DAY_MS = 24 * 60 * 60 * 1000;
const RECENT_TURNS = 30;

/** Everything the admin screen shows about the last `days` days. */
export async function summarizeUsage(days: number) {
  const since = new Date(Date.now() - days * DAY_MS);
  const turns = await readTurns(since);

  const byModel = new Map<string, Group>();
  const byMode = new Map<string, Group>();
  const byDay = new Map<string, Group>();
  const byBusiness = new Map<string, Group>();
  const total: TokenCount = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  const unpriced = new Set<string>();
  let costUsd = 0;

  for (const turn of turns) {
    const day = dayFormat.format(new Date(turn.at));
    addTo(byMode, turn.mode, 1);
    addTo(byDay, day, 1);
    const business = turn.businessId ?? UNKNOWN_BUSINESS;
    addTo(byBusiness, business, 1);
    for (const call of turn.calls) {
      // By model the unit is the request, since one turn can be served by several.
      addTo(byModel, call.model, 1, call);
      addTo(byMode, turn.mode, 0, call);
      addTo(byDay, day, 0, call);
      addTo(byBusiness, business, 0, call);
      total.input += call.input;
      total.output += call.output;
      total.cacheRead += call.cacheRead;
      total.cacheWrite += call.cacheWrite;
      const cost = costOf(call.model, call);
      if (cost === null) {
        unpriced.add(call.model);
      } else {
        costUsd += cost;
      }
    }
  }

  const answered = turns.filter((turn) => turn.outcome === 'ok');
  const firstText = answered.flatMap((turn) => (turn.firstTextMs === null ? [] : [turn.firstTextMs]));
  // Projected from the pace since the first turn in the period, not from the
  // whole period, so a log that started yesterday is not diluted over 30 days.
  const activeDays = turns.length
    ? Math.max(1, (Date.now() - new Date(turns[0].at).getTime()) / DAY_MS)
    : 0;

  return {
    days,
    currentModel: config.model,
    totals: {
      turns: turns.length,
      errors: turns.filter((turn) => turn.outcome === 'error').length,
      withTools: turns.filter((turn) => turn.tools.length > 0).length,
      costUsd,
      costPerTurnUsd: turns.length ? costUsd / turns.length : null,
      projectedMonthlyUsd: activeDays ? (costUsd / activeDays) * 30 : null,
      inputTokens: total.input + total.cacheRead + total.cacheWrite,
      outputTokens: total.output,
      cacheReadTokens: total.cacheRead,
    },
    latency: {
      firstTextMs: average(firstText),
      firstTextSlowMs: percentile(firstText, 0.9),
      totalMs: average(answered.map((turn) => turn.totalMs)),
    },
    byModel: [...byModel.values()].sort((a, b) => b.costUsd - a.costUsd),
    byMode: [...byMode.values()].sort((a, b) => b.costUsd - a.costUsd),
    byDay: [...byDay.values()].sort((a, b) => b.key.localeCompare(a.key)),
    // Keyed by business id ("unknown" for turns recorded before it was kept); the Admin names them.
    byBusiness: [...byBusiness.values()].sort((a, b) => b.costUsd - a.costUsd),
    // The same tokens priced on each model. Other models would not use exactly
    // the same number of tokens, so this is a guide, not a quote.
    whatIf: COMPARABLE_MODELS.map((model) => ({
      model,
      price: listPrice(model),
      costUsd: costOf(model, total),
    })),
    unpricedModels: [...unpriced],
    recent: turns
      .slice(-RECENT_TURNS)
      .reverse()
      .map((turn) => ({
        at: turn.at,
        mode: turn.mode,
        outcome: turn.outcome,
        model: turn.calls.at(-1)?.model ?? null,
        tools: turn.tools,
        inputTokens: turn.calls.reduce(
          (sum, call) => sum + call.input + call.cacheRead + call.cacheWrite,
          0,
        ),
        outputTokens: turn.calls.reduce((sum, call) => sum + call.output, 0),
        costUsd: turn.calls.reduce((sum, call) => sum + (costOf(call.model, call) ?? 0), 0),
        firstTextMs: turn.firstTextMs,
        totalMs: turn.totalMs,
      })),
  };
}
