import dayjs, { type Dayjs } from 'dayjs';

/** Cómo se elige el período de Finanzas: un día, una semana, un mes o un rango libre. */
export type PeriodMode = 'day' | 'week' | 'month' | 'range';

/** Un período como días calendario (YYYY-MM-DD), ambos incluidos. */
export interface Period {
  mode: PeriodMode;
  from: string;
  to: string;
}

const DAY = 'YYYY-MM-DD';

/** Lunes de la semana de una fecha: las semanas van de lunes a domingo. */
function monday(date: Dayjs): Dayjs {
  return date.subtract((date.day() + 6) % 7, 'day');
}

/** El día, la semana o el mes que contiene una fecha. Un rango nuevo empieza siendo el mes en curso hasta hoy. */
export function periodAround(mode: PeriodMode, anchor: Dayjs = dayjs()): Period {
  switch (mode) {
    case 'day':
      return { mode, from: anchor.format(DAY), to: anchor.format(DAY) };
    case 'week':
      return { mode, from: monday(anchor).format(DAY), to: monday(anchor).add(6, 'day').format(DAY) };
    case 'month':
      return { mode, from: anchor.startOf('month').format(DAY), to: anchor.endOf('month').format(DAY) };
    case 'range':
      return { mode, from: anchor.startOf('month').format(DAY), to: anchor.format(DAY) };
  }
}

/** El período anterior (-1) o siguiente (+1) del mismo tamaño. Un rango se desplaza por su propia duración. */
export function shiftPeriod(period: Period, direction: -1 | 1): Period {
  const from = dayjs(period.from);
  if (period.mode === 'range') {
    const days = dayjs(period.to).diff(from, 'day') + 1;
    return {
      mode: 'range',
      from: from.add(direction * days, 'day').format(DAY),
      to: dayjs(period.to).add(direction * days, 'day').format(DAY),
    };
  }
  return periodAround(period.mode, from.add(direction, period.mode));
}

export function daysInPeriod(period: Period): number {
  return dayjs(period.to).diff(dayjs(period.from), 'day') + 1;
}

/** Si el período contiene el día de hoy, para ofrecer "volver a hoy" solo cuando hace falta. */
export function includesToday(period: Period): boolean {
  const today = dayjs().format(DAY);
  return period.from <= today && today <= period.to;
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** El período en palabras: "Hoy", "Octubre de 2026", "12 – 18 oct 2026". */
export function describePeriod(period: Period): string {
  const from = dayjs(period.from);
  const to = dayjs(period.to);
  const day = (date: Dayjs) =>
    date.toDate().toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });

  if (period.mode === 'day') {
    if (from.isSame(dayjs(), 'day')) return 'Hoy';
    if (from.isSame(dayjs().subtract(1, 'day'), 'day')) return 'Ayer';
    return capitalize(
      from.toDate().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    );
  }
  if (period.mode === 'month') {
    return capitalize(from.toDate().toLocaleDateString('es-CO', { month: 'long', year: 'numeric' }));
  }
  if (from.isSame(to, 'day')) return day(from);
  const sameMonth = from.isSame(to, 'month');
  const start = sameMonth
    ? String(from.date())
    : from.toDate().toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
  return `${start} – ${day(to)}`;
}

/** Los instantes que cubre el período en la hora local del equipo, para las consultas de ventas. */
export function periodInstants(period: Period): { dateFrom: string; dateTo: string } {
  return {
    dateFrom: dayjs(period.from).startOf('day').toISOString(),
    dateTo: dayjs(period.to).endOf('day').toISOString(),
  };
}
