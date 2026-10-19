import 'reflect-metadata';
import { Type, plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  validateSync,
} from 'class-validator';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
  Provision = 'provision',
}

class EnvironmentVariables {
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment = Environment.Development;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  @IsOptional()
  PORT: number = 3000;

  @IsString()
  @IsOptional()
  API_PREFIX: string = 'api/v1';

  @IsString()
  @IsOptional()
  CORS_ORIGIN: string = '*';

  @IsString()
  @IsNotEmpty()
  DB_HOST: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  DB_PORT: number;

  @IsString()
  @IsNotEmpty()
  DB_NAME: string;

  @IsString()
  @IsNotEmpty()
  DB_USER: string;

  @IsString()
  @IsOptional()
  DB_PASSWORD: string = '';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  DB_POOL_MAX: number = 10;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  DB_IDLE_TIMEOUT_MS: number = 30000;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  DB_CONNECTION_TIMEOUT_MS: number = 5000;

  @IsString()
  @IsOptional()
  DB_SSL: string = 'false';

  @IsString()
  @IsNotEmpty()
  JWT_ACCESS_SECRET: string;

  @IsString()
  @IsOptional()
  JWT_ACCESS_EXPIRES_IN: string = '15m';

  @IsString()
  @IsNotEmpty()
  JWT_REFRESH_SECRET: string;

  @IsString()
  @IsOptional()
  JWT_REFRESH_EXPIRES_IN: string = '7d';

  @IsUUID()
  @IsNotEmpty()
  CAR_SERVICE_BUSINESS_ID: string;

  @IsUUID()
  @IsNotEmpty()
  CAR_SERVICE_BRANCH_ID: string;

  /** "Rectificar caja": shared admin secret required to reopen a closed cash session for
   *  correction. Empty disables the feature (the endpoint rejects with MASTER_KEY_NOT_CONFIGURED). */
  @IsString()
  @IsOptional()
  CASH_SESSION_MASTER_KEY: string = '';

  /** Encrypts third-party credentials kept in the database (electronic invoicing).
   *  Empty: those credentials cannot be saved, and electronic invoicing stays unavailable. */
  @IsString()
  @IsOptional()
  CREDENTIALS_ENCRYPTION_KEY: string = '';

  /** Shared with POS-ADMIN (the Admin's own service): the key of the internal
   *  API (/api/v1/internal). At least 32 characters; empty switches it off. */
  @IsString()
  @IsOptional()
  INTERNAL_API_KEY: string = '';

  /** Web Push (notifications to the couriers' phones). Generate the pair with
   *  `npx web-push generate-vapid-keys`; empty disables push (the apps still
   *  alert while open). VAPID_SUBJECT is a contact, "mailto:..." or a URL. */
  @IsString()
  @IsOptional()
  VAPID_PUBLIC_KEY: string = '';

  @IsString()
  @IsOptional()
  VAPID_PRIVATE_KEY: string = '';

  @IsString()
  @IsOptional()
  VAPID_SUBJECT: string = 'mailto:soporte@goldenbites.net';
}

export function validate(config: Record<string, unknown>) {
  // Explicit @Type() decorators drive the numeric conversion below, rather
  // than class-transformer's implicit (reflect-metadata-based) conversion:
  // esbuild-based runners (tsx, used by our npm scripts) never emit
  // TypeScript's decorator type metadata, so implicit conversion silently
  // fails outside a full tsc/ts-jest/ts-node compile.
  const validatedConfig = plainToInstance(EnvironmentVariables, config);

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    const messages = errors
      .map((error) => Object.values(error.constraints ?? {}).join(', '))
      .join('; ');
    throw new Error(`Environment validation failed: ${messages}`);
  }

  return validatedConfig;
}
