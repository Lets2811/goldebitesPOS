import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomInt } from 'node:crypto';
import { BusinessRuleException } from '../../../common/exceptions';
import {
  isSecretBoxConfigured,
  openSecret,
  sealSecret,
} from '../../../common/utils/secret-box.util';
import { AppConfig } from '../../../config/app.config';
import { DatabaseService } from '../../../database/database.service';
import { AuditService } from '../../audit/services/audit.service';

/** Easy to read out over the phone: no look-alike characters (0/O, 1/I/L). */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const MIN_LENGTH = 8;
const MAX_LENGTH = 64;

/** A business's master key as POS-ADMIN sees it. */
export interface MasterKeyStatus {
  /** The business has a key of its own. */
  hasOwnKey: boolean;
  /** Without one, the platform-wide key (CASH_SESSION_MASTER_KEY) applies, if any. */
  usesPlatformKey: boolean;
  /** Only when asked to reveal it. */
  key: string | null;
  updatedAt: Date | null;
}

/**
 * Each business's master key ("clave maestra") for rectifying closed cash
 * sessions. Stored encrypted so the Golden Bites team can recover it (from
 * POS-ADMIN, never from the POS); a business without one falls back to the
 * old platform-wide key, so nothing breaks until a key is set.
 */
@Injectable()
export class MasterKeysService {
  constructor(
    private readonly db: DatabaseService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {}

  /** The key a business's rectification is checked against, or null when there is none. */
  async keyFor(businessId: string): Promise<string | null> {
    const own = await this.findOwn(businessId);
    if (own) return openSecret(own.key_encrypted);
    return this.platformKey() || null;
  }

  async status(
    businessId: string,
    reveal: boolean,
    actorPlatformUserId?: string,
  ): Promise<MasterKeyStatus> {
    const own = await this.findOwn(businessId);
    if (reveal && own) {
      // Who looked at it, and when: the key opens every closed cash session of the business.
      await this.auditService.record({
        businessId,
        userId: actorPlatformUserId,
        entityType: 'business_master_key',
        entityId: businessId,
        action: 'REVEAL',
      });
    }
    return {
      hasOwnKey: own !== null,
      usesPlatformKey: own === null && this.platformKey() !== '',
      key: reveal && own ? openSecret(own.key_encrypted) : null,
      updatedAt: own?.updated_at ?? null,
    };
  }

  /** Sets the key: the one given, or a new random one. Returns it once, in the clear. */
  async reset(
    businessId: string,
    actorPlatformUserId: string | undefined,
    custom?: string,
  ): Promise<MasterKeyStatus> {
    if (!isSecretBoxConfigured()) {
      throw new BusinessRuleException(
        'El servidor no tiene CREDENTIALS_ENCRYPTION_KEY: no se pueden guardar claves maestras',
        'ENCRYPTION_NOT_CONFIGURED',
      );
    }
    const key = custom?.trim() || this.generate();
    if (key.length < MIN_LENGTH || key.length > MAX_LENGTH) {
      throw new BusinessRuleException(
        `La clave maestra debe tener entre ${MIN_LENGTH} y ${MAX_LENGTH} caracteres`,
        'MASTER_KEY_INVALID',
      );
    }
    const result = await this.db.query<{ updated_at: Date }>(
      `INSERT INTO business_master_keys (business_id, key_encrypted, updated_at)
       VALUES ($1, $2, now())
       ON CONFLICT (business_id) DO UPDATE SET key_encrypted = EXCLUDED.key_encrypted, updated_at = now()
       RETURNING updated_at`,
      [businessId, sealSecret(key)],
    );
    await this.auditService.record({
      businessId,
      userId: actorPlatformUserId,
      entityType: 'business_master_key',
      entityId: businessId,
      action: 'RESET',
      // Never the key itself.
      newValues: { generated: !custom },
    });
    return {
      hasOwnKey: true,
      usesPlatformKey: false,
      key,
      updatedAt: result.rows[0].updated_at,
    };
  }

  /** "K7P2-QXM4-9RTA": 12 characters in groups of four. */
  private generate(): string {
    const chars = Array.from(
      { length: 12 },
      () => ALPHABET[randomInt(ALPHABET.length)],
    );
    return [0, 4, 8].map((i) => chars.slice(i, i + 4).join('')).join('-');
  }

  private platformKey(): string {
    return this.configService.getOrThrow<AppConfig>('app').cashSession
      .masterKey;
  }

  private async findOwn(
    businessId: string,
  ): Promise<{ key_encrypted: string; updated_at: Date } | null> {
    const result = await this.db.query<{
      key_encrypted: string;
      updated_at: Date;
    }>(
      `SELECT key_encrypted, updated_at FROM business_master_keys WHERE business_id = $1`,
      [businessId],
    );
    return result.rows[0] ?? null;
  }
}
