/** A point read from a shared location, with the place's name when the link carries one. */
export interface ParsedLocation {
  latitude: number;
  longitude: number;
  label: string | null;
}

const NUMBER = String.raw`-?\d{1,3}(?:\.\d+)?`;

const valid = (lat: number, lng: number) =>
  Number.isFinite(lat) &&
  Number.isFinite(lng) &&
  Math.abs(lat) <= 90 &&
  Math.abs(lng) <= 180 &&
  // 0,0 is in the ocean: a link that says it carries no location.
  !(lat === 0 && lng === 0);

function pair(
  lat: string,
  lng: string,
): { latitude: number; longitude: number } | null {
  const latitude = Number(lat);
  const longitude = Number(lng);
  return valid(latitude, longitude) ? { latitude, longitude } : null;
}

/** "Parque+Lleras" from a Google Maps /place/ path, or a non-coordinate q= text. */
function labelFrom(url: URL | null): string | null {
  if (!url) return null;
  const place = /\/maps\/place\/([^/@]+)/.exec(url.pathname)?.[1];
  const raw =
    place ?? url.searchParams.get('q') ?? url.searchParams.get('query') ?? null;
  if (!raw) return null;
  const text = decodeURIComponent(raw.replace(/\+/g, ' ')).trim();
  if (!text || new RegExp(`^${NUMBER}\\s*,\\s*${NUMBER}$`).test(text))
    return null;
  return text.slice(0, 200);
}

function toUrl(text: string): URL | null {
  const match = /https?:\/\/\S+/i.exec(text);
  if (!match) return null;
  try {
    return new URL(match[0].replace(/[).,;]+$/, ''));
  } catch {
    return null;
  }
}

/**
 * Coordinates in what WhatsApp (or Maps) shares, without any network call:
 * - Android WhatsApp: https://maps.google.com/?q=6.2442,-75.5812
 * - iPhone WhatsApp: https://maps.apple.com/?ll=6.2442,-75.5812&q=...
 * - Google Maps links: .../@6.2442,-75.5812,17z/... or ...!3d6.2442!4d-75.5812
 * - Waze: https://waze.com/ul?ll=6.2442,-75.5812
 * - Plain coordinates: "6.2442, -75.5812"
 * Short links (maps.app.goo.gl) carry none: resolve them first, see
 * DeliveryLocationService.
 */
export function parseLocationText(text: string): ParsedLocation | null {
  const input = text.trim();
  if (!input) return null;
  const url = toUrl(input);
  const label = labelFrom(url);

  if (url) {
    // The pin itself (!3d!4d) beats the map's viewport (@), which may be off-centre.
    const pin = /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/.exec(url.href);
    if (pin) {
      const p = pair(pin[1], pin[2]);
      if (p) return { ...p, label };
    }
    for (const key of [
      'q',
      'query',
      'll',
      'sll',
      'daddr',
      'destination',
      'center',
    ]) {
      const value = url.searchParams.get(key);
      const m =
        value &&
        new RegExp(`(${NUMBER})\\s*,\\s*(${NUMBER})`).exec(
          decodeURIComponent(value),
        );
      if (m) {
        const p = pair(m[1], m[2]);
        if (p)
          return { ...p, label: key === 'q' || key === 'query' ? null : label };
      }
    }
    const at = new RegExp(`@(${NUMBER}),(${NUMBER})`).exec(url.href);
    if (at) {
      const p = pair(at[1], at[2]);
      if (p) return { ...p, label };
    }
  }

  // Coordinates typed or pasted as text (also "6.2442,-75.5812" inside a longer message).
  const plain = new RegExp(
    `(?:^|[^\\d.-])(${NUMBER})\\s*,\\s*(${NUMBER})(?![\\d.])`,
  ).exec(url ? '' : input);
  if (plain && plain[1].includes('.') && plain[2].includes('.')) {
    const p = pair(plain[1], plain[2]);
    if (p) return { ...p, label: null };
  }
  return null;
}

/** Hosts whose short links may be followed to find the coordinates (nothing else is fetched). */
export const SHORT_LINK_HOSTS = ['maps.app.goo.gl', 'goo.gl', 'g.co'];
export const MAPS_HOSTS = [
  ...SHORT_LINK_HOSTS,
  'maps.google.com',
  'google.com',
  'www.google.com',
  'maps.apple.com',
  'waze.com',
  'www.waze.com',
];

/** The first link in the text, when it is a short link that has to be followed. */
export function shortLinkIn(text: string): URL | null {
  const url = toUrl(text);
  return url && SHORT_LINK_HOSTS.includes(url.hostname.toLowerCase())
    ? url
    : null;
}
