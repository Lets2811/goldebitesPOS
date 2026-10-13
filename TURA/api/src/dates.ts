import { config } from './config.js';

/** Offset of the business timezone from UTC at a given instant, in minutes (e.g. -300 for Bogotá). */
function offsetMinutes(at: Date): number {
  const name = new Intl.DateTimeFormat('en-US', {
    timeZone: config.timezone,
    timeZoneName: 'longOffset',
  })
    .formatToParts(at)
    .find((part) => part.type === 'timeZoneName')?.value;

  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(name ?? '');
  if (!match) {
    return 0;
  }
  const minutes = Number(match[2]) * 60 + Number(match[3]);
  return match[1] === '-' ? -minutes : minutes;
}

/**
 * Turns a business-local calendar day (YYYY-MM-DD) into the UTC instant where
 * it starts or ends. GB-BE filters on timestamps, so a bare date would cut the
 * day at UTC midnight instead of at the restaurant's midnight.
 */
export function dayBoundary(day: string, edge: 'start' | 'end'): string {
  const [year, month, date] = day.split('-').map(Number);
  const utcMidnight = Date.UTC(year, month - 1, date);
  const start = utcMidnight - offsetMinutes(new Date(utcMidnight)) * 60_000;
  const instant = edge === 'start' ? start : start + 24 * 60 * 60_000 - 1;
  return new Date(instant).toISOString();
}

/** The weekday, date and time in the business timezone, for the system prompt. */
export function nowInBusinessTimezone(at = new Date()): string {
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: config.timezone,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(at);
}
