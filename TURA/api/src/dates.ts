import { config } from './config.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Today's calendar day (YYYY-MM-DD) where the business is, which near midnight is not the server's or UTC's. */
export function todayInBusinessTimezone(at = new Date()): string {
  // en-CA writes dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: config.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at);
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

/** Whether the value is a real calendar day written as YYYY-MM-DD (2026-02-30 is not). */
export function isCalendarDay(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return false;
  }
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

/** The calendar day `count` days after another (before, with a negative count). */
export function addDays(day: string, count: number): string {
  return new Date(Date.parse(day) + count * DAY_MS).toISOString().slice(0, 10);
}

/** How many calendar days a range covers, both ends included. */
export function daysInRange(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS) + 1;
}

/** 0 for Monday through 6 for Sunday: weeks run Monday to Sunday. */
export function weekdayIndex(day: string): number {
  return (new Date(Date.parse(day)).getUTCDay() + 6) % 7;
}
