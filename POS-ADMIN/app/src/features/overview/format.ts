/** Amounts TURA costs are fractions of a cent per turn, so small ones keep four decimals. */
export function formatUsd(value: number | null): string {
  if (value === null) return '—';
  return `US$ ${value.toFixed(value !== 0 && value < 1 ? 4 : 2)}`;
}

export function formatSeconds(ms: number | null): string {
  return ms === null ? '—' : `${(ms / 1000).toFixed(1)} s`;
}

const RELATIVE = new Intl.RelativeTimeFormat('es-CO', { numeric: 'auto' });

/** "hace 3 días", "ayer", "hace 2 horas"; "Nunca" without a date. */
export function formatAgo(date: string | null, never = 'Nunca'): string {
  if (!date) return never;
  const minutes = Math.round((new Date(date).getTime() - Date.now()) / 60_000);
  if (Math.abs(minutes) < 60) return RELATIVE.format(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return RELATIVE.format(hours, 'hour');
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 45) return RELATIVE.format(days, 'day');
  return RELATIVE.format(Math.round(days / 30), 'month');
}
