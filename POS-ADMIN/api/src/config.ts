import { registerAs } from '@nestjs/config';

export interface AdminConfig {
  port: number;
  corsOrigin: string;
  /** Signs this service's own sessions; never the POS's secret. */
  jwtSecret: string;
  accessExpiresIn: string;
  refreshExpiresIn: string;
  /** GB-BE's internal API, e.g. http://backend:3000/api/v1/internal. */
  posInternalUrl: string;
  /** Shared with GB-BE (its INTERNAL_API_KEY). */
  internalApiKey: string;
  database: {
    host: string;
    port: number;
    name: string;
    user: string;
    password: string;
    ssl: boolean;
  };
}

function required(name: string, minLength = 1): string {
  const value = process.env[name] ?? '';
  if (value.length < minLength) {
    throw new Error(`${name} is not set${minLength > 1 ? ` (at least ${minLength} characters)` : ''}`);
  }
  return value;
}

export default registerAs(
  'admin',
  (): AdminConfig => ({
    port: parseInt(process.env.PORT ?? '3200', 10),
    corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5175',
    jwtSecret: required('ADMIN_JWT_SECRET', 32),
    accessExpiresIn: process.env.ADMIN_JWT_EXPIRES_IN ?? '15m',
    refreshExpiresIn: process.env.ADMIN_REFRESH_EXPIRES_IN ?? '7d',
    posInternalUrl: (process.env.POS_INTERNAL_URL ?? 'http://localhost:3000/api/v1/internal').replace(/\/+$/, ''),
    internalApiKey: required('INTERNAL_API_KEY', 32),
    database: {
      host: process.env.DB_HOST ?? 'localhost',
      port: parseInt(process.env.DB_PORT ?? '5432', 10),
      name: required('DB_NAME'),
      user: required('DB_USER'),
      password: process.env.DB_PASSWORD ?? '',
      ssl: process.env.DB_SSL === 'true',
    },
  }),
);
