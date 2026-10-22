/**
 * Where the installed phone apps (the waiter's and the courier's, GB built
 * with Capacitor) call from: the page inside the phone. Android runs them at
 * http://localhost (https://localhost is Capacitor's default, kept for apps
 * built before); iPhone at capacitor://localhost. They are allowed on every
 * server (local, staging, production), so the same app can be pointed at any
 * of them without editing CORS_ORIGIN.
 */
export const PHONE_APP_ORIGINS = [
  'http://localhost',
  'https://localhost',
  'capacitor://localhost',
];

/**
 * The origins the API answers to (CORS): CORS_ORIGIN, a comma-separated
 * list, plus the phone apps'. "*" answers any origin.
 */
export function corsOrigins(corsOrigin: string): true | string[] {
  if (corsOrigin === '*') return true;
  const configured = corsOrigin
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  return [...new Set([...configured, ...PHONE_APP_ORIGINS])];
}
