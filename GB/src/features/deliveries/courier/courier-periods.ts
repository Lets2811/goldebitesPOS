export type CourierPeriod = 'today' | 'week';

export const PERIOD_LABELS: Record<CourierPeriod, string> = { today: 'Hoy', week: 'Últimos 7 días' };

/** Start of the period on this phone's clock, as an ISO string (stable for the day, so it caches). */
export function periodStart(period: CourierPeriod): string {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  if (period === 'week') start.setDate(start.getDate() - 6);
  return start.toISOString();
}
