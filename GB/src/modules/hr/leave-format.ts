import dayjs from 'dayjs';

const shortDate = (date: string, withYear: boolean) =>
  dayjs(date)
    .toDate()
    .toLocaleDateString('es-CO', { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}) });

/** "20 oct 2026", o "20 – 22 oct 2026" para varios días. */
export function formatLeaveDates(startDate: string, endDate: string): string {
  if (startDate === endDate) return shortDate(startDate, true);
  const sameMonth = dayjs(startDate).isSame(dayjs(endDate), 'month');
  const start = sameMonth ? String(dayjs(startDate).date()) : shortDate(startDate, false);
  return `${start} – ${shortDate(endDate, true)}`;
}

/** Días calendario que cubre, contando ambos extremos. */
export function leaveDayCount(startDate: string, endDate: string): number {
  return dayjs(endDate).diff(dayjs(startDate), 'day') + 1;
}
