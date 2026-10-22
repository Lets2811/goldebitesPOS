function requireEnv(key: keyof ImportMetaEnv): string {
  const value = import.meta.env[key];
  if (!value) {
    throw new Error(
      `Missing required environment variable "${key}". Check your .env.development file (see .env.example).`,
    );
  }
  return value;
}

const appEnv = import.meta.env.VITE_APP_ENV || 'production';

/** The phone apps made from the POS (see capacitor.config.ts). */
export type PhoneApp = 'waiter' | 'courier';

const shell = import.meta.env.VITE_APP_SHELL;
const phoneApp: PhoneApp | null = shell === 'waiter' || shell === 'courier' ? shell : null;

/**
 * The servers a phone app can talk to, picked on the sign-in screen (three
 * taps on the Midas Tech logo, see ServerPickerDialog). The web app always
 * talks to the server it was opened from.
 */
export type ServerTarget = 'local' | 'staging' | 'production';

export const SERVER_URLS: Record<Exclude<ServerTarget, 'local'>, string> = {
  staging: 'https://staging.goldenbites.net/api/v1',
  production: 'https://goldenbites.net/api/v1',
};

/** This computer's API for a phone on the same Wi-Fi, as of when the app was built (vite.config.ts). */
export const DEFAULT_LOCAL_API_URL =
  import.meta.env.VITE_LOCAL_API_URL || 'http://192.168.1.10:3000/api/v1';

/** Where the phone app keeps the server picked (this phone only). */
export const SERVER_CHOICE_KEY = 'gb-server';

export interface ServerChoice {
  target: ServerTarget;
  /** The API's address, with its prefix (".../api/v1"). */
  url: string;
}

function readServerChoice(): ServerChoice | null {
  if (!phoneApp) return null;
  try {
    const choice = JSON.parse(
      localStorage.getItem(SERVER_CHOICE_KEY) ?? 'null',
    ) as ServerChoice | null;
    const valid =
      choice !== null &&
      ['local', 'staging', 'production'].includes(choice.target) &&
      typeof choice.url === 'string' &&
      /^https?:\/\//.test(choice.url);
    return valid ? choice : null;
  } catch {
    return null;
  }
}

function targetOf(url: string): ServerTarget {
  if (url === SERVER_URLS.production) return 'production';
  return url === SERVER_URLS.staging ? 'staging' : 'local';
}

// A phone app: the server picked on this phone, or else the one it was built with.
const apiBaseUrl = readServerChoice()?.url ?? requireEnv('VITE_API_BASE_URL');
const serverTarget: ServerTarget | null = phoneApp ? targetOf(apiBaseUrl) : null;

export const env = {
  apiBaseUrl,
  /** Which deployment this build is for: "production" unless built with VITE_APP_ENV. */
  appEnv,
  /** The demo copy at staging.goldenbites.net (or a phone app talking to it): shows the STAGING chip. */
  isStaging: appEnv === 'staging' || serverTarget === 'staging',
  /** Which server a phone app talks to; null in the web app. */
  serverTarget,
  /** TURA's app (the assistant), where a link code is entered. Empty when not deployed. */
  turaAppUrl: import.meta.env.VITE_TURA_APP_URL || '',
  /** Google Maps browser key (Domicilios). Empty: the map shows a notice instead. */
  googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
  /**
   * Built as a phone app (Android/iOS, see capacitor.config.ts): only signing
   * in and that app's screen. Null: the whole POS.
   */
  phoneApp,
  /** The waiter's phone app. */
  isWaiterApp: phoneApp === 'waiter',
};
