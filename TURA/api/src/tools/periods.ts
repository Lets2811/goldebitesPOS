import { addDays, weekdayIndex } from '../dates.js';

/**
 * The periods people ask about by name. The model only picks one of these
 * labels; which days it means is worked out here, from today's date, so that
 * "la semana pasada" is the same range every time and can be tested.
 *
 * The calendar these follow, since the POS defines none of its own:
 * - a week runs Monday to Sunday;
 * - a weekend is its Saturday and Sunday;
 * - "this" week, month or year ends today; "last" ones are whole.
 */
export const PERIODS = [
  'hoy',
  'ayer',
  'esta_semana',
  'semana_pasada',
  'este_fin_de_semana',
  'fin_de_semana_pasado',
  'este_mes',
  'mes_pasado',
  'este_anio',
  'anio_pasado',
  'ultimos_7_dias',
  'ultimos_30_dias',
] as const;

export type Period = (typeof PERIODS)[number];

export interface DayRange {
  desde: string;
  hasta: string;
}

const firstOfMonth = (day: string) => `${day.slice(0, 7)}-01`;
const firstOfYear = (day: string) => `${day.slice(0, 4)}-01-01`;

/** The days a named period covers, given today's calendar day (YYYY-MM-DD). */
export function resolvePeriod(period: Period, today: string): DayRange {
  const monday = addDays(today, -weekdayIndex(today));

  switch (period) {
    case 'hoy':
      return { desde: today, hasta: today };
    case 'ayer':
      return { desde: addDays(today, -1), hasta: addDays(today, -1) };
    case 'esta_semana':
      return { desde: monday, hasta: today };
    case 'semana_pasada':
      return { desde: addDays(monday, -7), hasta: addDays(monday, -1) };
    case 'este_fin_de_semana': {
      // On a Saturday or Sunday it is the one under way, up to today. On a
      // weekday it is the one that just ended: nobody asking on a Tuesday
      // about "este fin de semana" means days that have not happened yet.
      const saturday = addDays(monday, 5);
      return today >= saturday
        ? { desde: saturday, hasta: today }
        : { desde: addDays(saturday, -7), hasta: addDays(saturday, -6) };
    }
    case 'fin_de_semana_pasado': {
      // The weekend before the one "este_fin_de_semana" means.
      const saturday = addDays(monday, 5);
      const current = today >= saturday ? saturday : addDays(saturday, -7);
      return { desde: addDays(current, -7), hasta: addDays(current, -6) };
    }
    case 'este_mes':
      return { desde: firstOfMonth(today), hasta: today };
    case 'mes_pasado': {
      // The whole calendar month before this one, whatever today's date.
      const lastDay = addDays(firstOfMonth(today), -1);
      return { desde: firstOfMonth(lastDay), hasta: lastDay };
    }
    case 'este_anio':
      return { desde: firstOfYear(today), hasta: today };
    case 'anio_pasado': {
      const lastDay = addDays(firstOfYear(today), -1);
      return { desde: firstOfYear(lastDay), hasta: lastDay };
    }
    case 'ultimos_7_dias':
      return { desde: addDays(today, -6), hasta: today };
    case 'ultimos_30_dias':
      return { desde: addDays(today, -29), hasta: today };
  }
}
