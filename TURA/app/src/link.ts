/**
 * The link between this TURA app and a user of the POS. TURA has no accounts
 * of its own: a POS user generates a short code there, says or types it
 * here, and GB-BE answers with a link token for that user. The token stays
 * on this device and is exchanged for short-lived access tokens, which are
 * what TURA/api uses to read the POS as that user, with what their role lets
 * them see.
 */
const POS_API = '/api/v1';
const STORAGE_KEY = 'tura-links';
/** Where a single link was kept before a device could hold several; read once to carry it over. */
const LEGACY_STORAGE_KEY = 'tura-link';

/** The POS user this app is linked to, and their business, to show and to greet. */
export interface Link {
  userName: string;
  businessName: string;
}

interface StoredLink extends Link {
  linkToken: string;
}

/**
 * A device can be linked to several businesses (someone who runs more than
 * one, or whoever demos TURA), one link each. TURA answers for one at a time:
 * the active one.
 */
interface Stored {
  links: StoredLink[];
  active: number;
}

function load(): Stored {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Stored | null;
    if (stored && Array.isArray(stored.links)) {
      const links = stored.links.filter((item) => item?.linkToken);
      return { links, active: Math.min(Math.max(stored.active, 0), Math.max(links.length - 1, 0)) };
    }
    const legacy = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY) ?? 'null') as StoredLink | null;
    return legacy?.linkToken ? { links: [legacy], active: 0 } : { links: [], active: 0 };
  } catch {
    return { links: [], active: 0 };
  }
}

let state: Stored = load();
/** Kept in memory only, for the active link; a reload gets a new one with the link token. */
let access: { token: string; expiresAt: number } | null = null;
const listeners = new Set<() => void>();

function setState(next: Stored): void {
  const activeChanged = next.links[next.active]?.linkToken !== state.links[state.active]?.linkToken;
  state = next;
  if (activeChanged) {
    access = null;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // Private mode or storage full: the links last until the app is closed.
  }
  listeners.forEach((listener) => listener());
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The link TURA is answering for right now, or null when the app is not linked. */
export function getLink(): Link | null {
  return state.links[state.active] ?? null;
}

/** Every business this device is linked to. */
export function getLinks(): readonly Link[] {
  return state.links;
}

/** Makes TURA answer for another of the linked businesses. */
export function switchLink(index: number): void {
  if (index !== state.active && state.links[index]) {
    setState({ ...state, active: index });
  }
}

function removeLink(linkToken: string): void {
  const links = state.links.filter((item) => item.linkToken !== linkToken);
  const current = state.links[state.active]?.linkToken;
  const active = Math.max(links.findIndex((item) => item.linkToken === current), 0);
  setState({ links, active });
}

/** Forgets the active link on this device. Revoking it for good is done in the POS. */
export function unlink(): void {
  const current = state.links[state.active];
  if (current) {
    removeLink(current.linkToken);
  }
}

async function post<T>(path: string, body: unknown): Promise<{ status: number; data: T | null; message: string | null }> {
  let response: Response;
  try {
    response = await fetch(`${POS_API}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('No pude conectarme con el POS. Revisa tu conexión.');
  }
  const payload = (await response.json().catch(() => null)) as {
    data?: T;
    message?: string;
  } | null;
  return {
    status: response.status,
    data: response.ok ? (payload?.data ?? null) : null,
    message: payload?.message ?? null,
  };
}

/** Links this app to the user who generated the code. Throws with a message to show or say. */
export async function redeemLink(code: string): Promise<Link> {
  const { status, data } = await post<StoredLink>('/tura-links/redeem', { code });
  if (status === 429) {
    throw new Error('Fueron demasiados intentos. Espera un minuto y dime el código otra vez.');
  }
  if (!data) {
    throw new Error(
      'Ese código no es válido o ya venció. Genera uno nuevo en el POS y dímelo otra vez.',
    );
  }
  // Linking the same user of the same business again replaces that link, and
  // whichever was just linked becomes the active one.
  const added: StoredLink = {
    linkToken: data.linkToken,
    userName: data.userName,
    businessName: data.businessName,
  };
  const links = state.links.filter(
    (item) => item.businessName !== added.businessName || item.userName !== added.userName,
  );
  setState({ links: [...links, added], active: links.length });
  return data;
}

const EXPIRY_MARGIN_MS = 30_000;
// Deduplicates concurrent requests for a token, e.g. chat and voice at once.
// Kept per link, so a request for one business never gets another's token.
let pending: { linkToken: string; token: Promise<string | null> } | null = null;

/**
 * An access token for TURA/api, or null when this app is not linked. `renew`
 * skips the one in memory, for when the service has just rejected it.
 */
export function getAccessToken(renew = false): Promise<string | null> {
  const link = state.links[state.active];
  if (!link) {
    return Promise.resolve(null);
  }
  if (!renew && access && access.expiresAt - EXPIRY_MARGIN_MS > Date.now()) {
    return Promise.resolve(access.token);
  }
  const { linkToken } = link;
  if (pending?.linkToken === linkToken) {
    return pending.token;
  }
  const request = (async () => {
    const { status, data } = await post<{ accessToken: string; expiresIn: number } & Link>(
      '/tura-links/token',
      { linkToken },
    );
    if (status === 401) {
      // The POS no longer honours the link (it was revoked, the user was
      // deactivated or the business lost TURA): that business has to be linked again.
      removeLink(linkToken);
      return null;
    }
    if (!data) {
      throw new Error('No pude conectarme con el POS. Intenta de nuevo en un momento.');
    }
    // Only cached while that business is still the active one: switching
    // during the request leaves this token to the question that asked for it.
    if (state.links[state.active]?.linkToken === linkToken) {
      access = { token: data.accessToken, expiresAt: Date.now() + data.expiresIn * 1000 };
    }
    return data.accessToken;
  })().finally(() => {
    if (pending?.token === request) {
      pending = null;
    }
  });
  pending = { linkToken, token: request };
  return request;
}
