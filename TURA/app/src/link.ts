/**
 * The link between this TURA app and a user of the POS. TURA has no accounts
 * of its own: a POS user generates a short code there, says or types it
 * here, and GB-BE answers with a link token for that user. The token stays
 * on this device and is exchanged for short-lived access tokens, which are
 * what TURA/api uses to read the POS as that user, with what their role lets
 * them see.
 */
const POS_API = '/api/v1';
const STORAGE_KEY = 'tura-link';

/** The POS user this app is linked to, and their business, to show and to greet. */
export interface Link {
  userName: string;
  businessName: string;
}

interface StoredLink extends Link {
  linkToken: string;
}

function load(): StoredLink | null {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as StoredLink | null;
    return stored?.linkToken ? stored : null;
  } catch {
    return null;
  }
}

let link: StoredLink | null = load();
/** Kept in memory only; a reload gets a new one with the link token. */
let access: { token: string; expiresAt: number } | null = null;
const listeners = new Set<() => void>();

function setLink(next: StoredLink | null): void {
  link = next;
  access = null;
  if (next) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
  listeners.forEach((listener) => listener());
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getLink(): Link | null {
  return link;
}

/** Forgets the link on this device. Revoking it for good is done in the POS. */
export function unlink(): void {
  setLink(null);
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
  setLink({ linkToken: data.linkToken, userName: data.userName, businessName: data.businessName });
  return data;
}

const EXPIRY_MARGIN_MS = 30_000;
// Deduplicates concurrent requests for a token, e.g. chat and voice at once.
let pending: Promise<string | null> | null = null;

/**
 * An access token for TURA/api, or null when this app is not linked. `renew`
 * skips the one in memory, for when the service has just rejected it.
 */
export function getAccessToken(renew = false): Promise<string | null> {
  if (!link) {
    return Promise.resolve(null);
  }
  if (!renew && access && access.expiresAt - EXPIRY_MARGIN_MS > Date.now()) {
    return Promise.resolve(access.token);
  }
  const { linkToken } = link;
  pending ??= (async () => {
    const { status, data } = await post<{ accessToken: string; expiresIn: number } & Link>(
      '/tura-links/token',
      { linkToken },
    );
    if (status === 401) {
      // The POS no longer honours the link (it was revoked, the user was
      // deactivated or the business lost TURA): the app has to be linked again.
      setLink(null);
      return null;
    }
    if (!data) {
      throw new Error('No pude conectarme con el POS. Intenta de nuevo en un momento.');
    }
    access = { token: data.accessToken, expiresAt: Date.now() + data.expiresIn * 1000 };
    return data.accessToken;
  })().finally(() => {
    pending = null;
  });
  return pending;
}
