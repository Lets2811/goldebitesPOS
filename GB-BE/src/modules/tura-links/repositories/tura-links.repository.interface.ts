import {
  TuraLinkRow,
  TuraLinkWithUserRow,
} from '../domain/tura-link.interface';
import {
  CreateLinkCodeData,
  RedeemLinkCodeData,
} from '../domain/tura-link.types';

export interface ITuraLinksRepository {
  /** Whether an unused, unexpired code with this hash exists, in any business. */
  hasActiveCode(codeHash: string): Promise<boolean>;
  createCode(data: CreateLinkCodeData): Promise<void>;
  /**
   * Spends the code and creates the link of the user who generated it, in one
   * statement; null if the code is not valid.
   */
  redeemCode(data: RedeemLinkCodeData): Promise<TuraLinkRow | null>;
  /** The active link holding this token, marked as used now. */
  touchByTokenHash(tokenHash: string): Promise<TuraLinkRow | null>;
  findActive(businessId: string, id: string): Promise<TuraLinkRow | null>;
  findAllActive(businessId: string): Promise<TuraLinkWithUserRow[]>;
  revoke(businessId: string, id: string): Promise<boolean>;
  /** Revokes the active link holding this token, if any. */
  revokeByTokenHash(tokenHash: string): Promise<void>;
}

export const TURA_LINKS_REPOSITORY = Symbol('TURA_LINKS_REPOSITORY');
