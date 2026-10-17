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

export const env = {
  apiBaseUrl: requireEnv('VITE_API_BASE_URL'),
  /** Which deployment this build is for: "production" unless built with VITE_APP_ENV. */
  appEnv,
  /** The demo copy at staging.goldenbites.net: shows the STAGING chip. */
  isStaging: appEnv === 'staging',
};
