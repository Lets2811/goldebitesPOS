/**
 * Calendar days as a business lives them. A day is a 'YYYY-MM-DD' string in
 * the business's own timezone; these turn it into the instants it covers, so
 * a sale at 11:30 PM in Bogotá belongs to that day and not to the next one,
 * as it would if days were cut at UTC midnight.
 */

const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Whether the value is a real calendar day written as YYYY-MM-DD (2026-02-30 is not). */
export function isCalendarDay(value: string): boolean {
  const match = DAY_PATTERN.exec(value);
  if (!match) {
    return false;
  }
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/** How far the timezone is from UTC at an instant, in milliseconds (negative west of Greenwich). */
function offsetMs(at: Date, timezone: string): number {
  const name = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    timeZoneName: 'longOffset',
  })
    .formatToParts(at)
    .find((part) => part.type === 'timeZoneName')?.value;

  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(name ?? '');
  if (!match) {
    return 0;
  }
  const minutes = Number(match[2]) * 60 + Number(match[3]);
  return (match[1] === '-' ? -minutes : minutes) * 60 * 1000;
}

/** The instant a calendar day begins in the timezone. */
export function businessDayStart(day: string, timezone: string): Date {
  const [year, month, date] = day.split('-').map(Number);
  const utcMidnight = Date.UTC(year, month - 1, date);
  // The offset is read at a first guess and again at the result: around a
  // clock change the two differ, and the second is the one in force that day.
  const guess = utcMidnight - offsetMs(new Date(utcMidnight), timezone);
  return new Date(utcMidnight - offsetMs(new Date(guess), timezone));
}

/** The calendar day after (or, with a negative count, before) another. */
export function addDays(day: string, count: number): string {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, date) + count * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

/** How many calendar days a range covers, both ends included. */
export function daysInRange(dayFrom: string, dayTo: string): number {
  return Math.round((Date.parse(dayTo) - Date.parse(dayFrom)) / DAY_MS) + 1;
}

/**
 * The instants a range of calendar days covers, both days included: from the
 * start of the first to the last millisecond of the last. In the shape the
 * sales queries take (they compare with <= at both ends).
 */
export function businessDayRange(
  dayFrom: string,
  dayTo: string,
  timezone: string,
): { dateFrom: string; dateTo: string } {
  const end = businessDayStart(addDays(dayTo, 1), timezone).getTime() - 1;
  return {
    dateFrom: businessDayStart(dayFrom, timezone).toISOString(),
    dateTo: new Date(end).toISOString(),
  };
}

/** Today's calendar day in the timezone. */
export function businessToday(timezone: string, now = new Date()): string {
  // en-CA writes dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}
