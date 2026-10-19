import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, type QueryResultRow } from 'pg';
import type { AdminConfig } from './config';

/**
 * The POS's database, for what belongs to the Admin only: its accounts and
 * sessions (platform_users, platform_refresh_tokens). Everything about
 * businesses goes through the POS's internal API instead (PosService), so
 * the POS's rules live in one place.
 */
@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly pool: Pool;

  constructor(configService: ConfigService) {
    const { database } = configService.getOrThrow<AdminConfig>('admin');
    this.pool = new Pool({
      host: database.host,
      port: database.port,
      database: database.name,
      user: database.user,
      password: database.password,
      ssl: database.ssl ? { rejectUnauthorized: false } : undefined,
      max: 3,
    });
  }

  query<T extends QueryResultRow>(text: string, params: unknown[] = []) {
    return this.pool.query<T>(text, params);
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
