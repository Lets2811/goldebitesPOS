const DIACRITIC_MARKS = new RegExp('[\\u0300-\\u036f]', 'g');

function sanitize(name: string): string {
  return name
    .normalize('NFD')
    .replace(DIACRITIC_MARKS, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
}

/**
 * e.g. "Juan" + "Pérez" -> "jupe". Pads a short/empty name's 2-letter slot
 * with 'x'; falls back to "us" only when both names sanitize to nothing
 * (all-symbol input). Caller appends a disambiguating number and domain.
 */
export function buildLoginHandleBase(
  firstName: string,
  lastName: string,
): string {
  const first = sanitize(firstName);
  const last = sanitize(lastName);
  if (!first && !last) return 'us';

  const firstPart = first.slice(0, 2).padEnd(2, 'x');
  const lastPart = last.slice(0, 2).padEnd(2, 'x');
  return `${firstPart}${lastPart}`;
}
