/**
 * Checks, against the real model, that the ways people ask about sales end
 * up as the right calls to consultar_ventas. The dates a period means are
 * unit-tested in tools/periods.test.ts; what only the model decides — which
 * period a phrase is, which dates a named month or an explicit range are —
 * is what this measures.
 *
 *   npm run eval:sales
 *
 * It calls Claude (a few cents) and no POS: the POS client is replaced by one
 * that records what it was asked. Not part of `npm test`: it costs money and
 * a model's answer is not deterministic.
 */
import { runTurn } from '../agent/agent.service.js';
import { newAudit } from '../audit/audit-log.js';
import { NO_BRANCHES, type Session } from '../auth.js';
import { addDays, todayInBusinessTimezone, weekdayIndex } from '../dates.js';
import type { PosClient } from '../pos/pos-client.js';
import { resolvePeriod, type Period } from '../tools/periods.js';
import { newMeter } from '../usage/usage-log.js';

type Query = Record<string, string>;

const today = todayInBusinessTimezone();
const year = Number(today.slice(0, 4));
const monday = addDays(today, -weekdayIndex(today));

const period = (name: Period): Query => {
  const { desde, hasta } = resolvePeriod(name, today);
  return { dateFrom: desde, dateTo: hasta };
};
const range = (dateFrom: string, dateTo: string): Query => ({ dateFrom, dateTo });

/** The most recent occurrence of a month that is not in the future, as a whole month or up to today. */
function namedMonth(month: number): Query {
  const monthYear = `${year}-${String(month).padStart(2, '0')}` <= today.slice(0, 7) ? year : year - 1;
  const first = `${monthYear}-${String(month).padStart(2, '0')}-01`;
  const last = new Date(Date.UTC(monthYear, month, 0)).toISOString().slice(0, 10);
  return range(first, last > today ? today : last);
}

interface Case {
  phrase: string;
  /** The calls expected, in any order: each lists the query values that must match. */
  expect: Query[];
  /**
   * Further calls that are also right. Comparing a week under way with the
   * last one, the model may fetch both the equivalent stretch and the whole
   * week, and say both: more than was asked, not a mistake.
   */
  alsoFine?: Query[];
}

const CASES: Case[] = [
  { phrase: '¿Cuánto vendimos hoy?', expect: [period('hoy')] },
  { phrase: '¿Cuánto vendimos ayer?', expect: [period('ayer')] },
  { phrase: '¿Cuánto llevamos vendido esta semana?', expect: [period('esta_semana')] },
  { phrase: '¿Cuánto vendimos la semana pasada?', expect: [period('semana_pasada')] },
  { phrase: '¿Cuánto hemos vendido este mes?', expect: [period('este_mes')] },
  { phrase: '¿Cómo nos fue el mes pasado?', expect: [period('mes_pasado')] },
  { phrase: 'dame las ventas del mes anterior', expect: [period('mes_pasado')] },
  { phrase: '¿Cuánto vendimos en enero?', expect: [namedMonth(1)] },
  { phrase: `¿Cuánto vendimos en enero de ${year}?`, expect: [range(`${year}-01-01`, `${year}-01-31`)] },
  { phrase: '¿Cuánto hemos vendido este año?', expect: [period('este_anio')] },
  { phrase: '¿Cuánto vendimos el año pasado?', expect: [period('anio_pasado')] },
  {
    phrase: '¿Cuánto vendimos del 1 al 15 de septiembre?',
    expect: [range(`${year}-09-01`, `${year}-09-15`)],
  },
  {
    phrase: '¿Cuánto vendimos del 15 de septiembre al 5 de octubre?',
    expect: [range(`${year}-09-15`, `${year}-10-05`)],
  },
  { phrase: '¿Cuánto vendimos este fin de semana?', expect: [period('este_fin_de_semana')] },
  { phrase: '¿Cuántas ventas hicimos ayer?', expect: [period('ayer')] },
  {
    phrase: 'Top 5 productos de esta semana',
    expect: [{ ...period('esta_semana'), includeTopProducts: 'true', topProductsLimit: '5' }],
  },
  {
    phrase: '¿Qué fue lo que más vendimos ayer?',
    expect: [{ ...period('ayer'), includeTopProducts: 'true' }],
  },
  {
    phrase: '¿Qué producto generó más ingresos el mes pasado?',
    expect: [{ ...period('mes_pasado'), includeTopProducts: 'true', topProductsOrder: 'revenue' }],
  },
  {
    phrase: '¿Cómo fueron las ventas de este mes por día?',
    expect: [{ ...period('este_mes'), groupBy: 'day' }],
  },
  {
    phrase: '¿Cuál fue el día que más vendimos este mes?',
    expect: [{ ...period('este_mes'), groupBy: 'day' }],
  },
  {
    phrase: '¿Cómo nos ha ido este año por mes?',
    expect: [{ ...period('este_anio'), groupBy: 'month' }],
  },
  {
    phrase: 'Compara esta semana con la semana pasada',
    expect: [period('esta_semana'), period('semana_pasada')],
    alsoFine: [range(addDays(monday, -7), addDays(today, -7))],
  },
  {
    phrase: 'Compara este mes con el mes pasado',
    expect: [period('este_mes'), period('mes_pasado')],
    alsoFine: [range(resolvePeriod('mes_pasado', today).desde, addDays(resolvePeriod('mes_pasado', today).desde, Number(today.slice(8)) - 1))],
  },
  {
    phrase: 'Compara septiembre con octubre',
    expect: [namedMonth(9), namedMonth(10)],
  },
  {
    phrase: '¿Cómo vamos esta semana comparado con la semana pasada?',
    // Equivalent stretches: Monday to today against Monday to the same weekday.
    expect: [period('esta_semana'), range(addDays(monday, -7), addDays(today, -7))],
    alsoFine: [period('semana_pasada')],
  },
  {
    phrase: 'dame las ventas de este mes en la sede Norte',
    expect: [{ ...period('este_mes'), branch: 'Norte' }],
  },
];

/**
 * A plausible answer for whatever was asked: the same period back, and only
 * the parts requested. An answer that did not match the question would make
 * the model ask again, and that would be the eval's fault, not the model's.
 */
function posAnswer(query: Query) {
  const { dateFrom, dateTo, groupBy, includeTopProducts, topProductsOrder, branch } = query;
  return {
    data: {
      period: { from: dateFrom, to: dateTo },
      scope: branch ? { branch, branches: [branch, 'Centro'] } : { branch: null },
      summary: { totalSales: 1250000, orderCount: 50, averageTicket: 25000 },
      ...(groupBy && {
        breakdown: {
          groupBy,
          items: [
            { from: dateFrom, to: dateFrom, totalSales: 450000, orderCount: 18 },
            { from: dateTo, to: dateTo, totalSales: 800000, orderCount: 32 },
          ],
        },
      }),
      ...(includeTopProducts === 'true' && {
        topProducts: {
          orderedBy: topProductsOrder ?? 'quantity',
          items: [
            { name: 'Combo Nuggets x6', quantitySold: 42, revenue: 504000 },
            { name: 'Agua manantial', quantitySold: 30, revenue: 180000 },
          ],
        },
      }),
    },
  };
}

async function callsFor(phrase: string): Promise<Query[]> {
  const calls: Query[] = [];
  const pos = {
    get: (_path: string, query: Record<string, string | number | boolean | undefined> = {}) => {
      const call = Object.fromEntries(
        Object.entries(query)
          .filter(([, value]) => value !== undefined)
          .map(([key, value]) => [key, String(value)]),
      );
      calls.push(call);
      return Promise.resolve(posAnswer(call));
    },
  } as unknown as PosClient;
  const session: Session = {
    pos,
    userId: 'eval',
    businessId: 'eval',
    firstName: 'Ana',
    businessName: 'Golden Bites',
    roleName: 'OWNER',
    branchId: null,
    branches: NO_BRANCHES,
    permissions: ['analytics.read', 'products.read', 'inventory.read'],
  };
  await runTurn({
    session,
    history: [{ role: 'user', content: phrase }],
    mode: 'chat',
    meter: newMeter(),
    audit: newAudit(),
    emit: () => undefined,
    isCancelled: () => false,
  });
  return calls;
}

const matches = (call: Query, expected: Query) =>
  Object.entries(expected).every(([key, value]) => call[key]?.toLowerCase() === value.toLowerCase());

const describeCall = (call: Query) =>
  `${call.dateFrom}→${call.dateTo}` +
  Object.entries(call)
    .filter(([key]) => key !== 'dateFrom' && key !== 'dateTo')
    .map(([key, value]) => ` ${key}=${value}`)
    .join('');

console.log(`Hoy es ${today}. ${CASES.length} frases.\n`);
let passed = 0;
for (const { phrase, expect, alsoFine = [] } of CASES) {
  const calls = await callsFor(phrase);
  // Every expected call was made, and nothing was asked that is not one of the right answers.
  const ok =
    expect.every((expected) => calls.some((call) => matches(call, expected))) &&
    calls.every((call) => [...expect, ...alsoFine].some((fine) => matches(call, fine)));
  passed += ok ? 1 : 0;
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${phrase}`);
  console.log(`      llamó:    ${calls.map(describeCall).join('  |  ') || '(ninguna)'}`);
  if (!ok) {
    console.log(`      esperado: ${expect.map(describeCall).join('  |  ')}`);
  }
}
console.log(`\n${passed} de ${CASES.length} correctas.`);
process.exitCode = passed === CASES.length ? 0 : 1;
