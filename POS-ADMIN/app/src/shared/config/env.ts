const appEnv = import.meta.env.VITE_APP_ENV || 'production';

/** POS-ADMIN's configuration (Vite env, read at build time). */
export const env = {
  /** POS-ADMIN's own API (POS-ADMIN/api). Relative: the dev server and nginx proxy it. */
  apiBaseUrl: import.meta.env.VITE_ADMIN_API_URL || '/admin-api/v1',
  /** Which deployment this build is for: "production" unless built with VITE_APP_ENV. */
  appEnv,
  /** The demo copy (staging): shows the STAGING chip. */
  isStaging: appEnv === 'staging',
  /** TURA's app, linked (with a QR) from a business's TURA panel. Empty hides the link. */
  turaAppUrl: import.meta.env.VITE_TURA_APP_URL || '',
};
