import { DbClient } from '../../../database/types/database.types';
import { NfcTagRow, PublicNfcResolution } from '../domain/nfc-tag.interface';
import { CreateNfcTagData, UpdateNfcTagData } from '../domain/nfc-tag.types';

export interface INfcTagsRepository {
  create(data: CreateNfcTagData & { token: string }, client?: DbClient): Promise<NfcTagRow>;
  findById(id: string, businessId: string, client?: DbClient): Promise<NfcTagRow | null>;
  findAllByBranch(businessId: string, branchId: string): Promise<NfcTagRow[]>;
  /** Pre-check backing the UNIQUE(branch_id, table_number) index — same "taken" pattern as BranchesRepository.existsByName. */
  existsForBranchTable(
    branchId: string,
    tableNumber: string,
    excludeId?: string,
  ): Promise<boolean>;
  update(id: string, businessId: string, data: UpdateNfcTagData): Promise<NfcTagRow | null>;
  setActive(id: string, businessId: string, isActive: boolean): Promise<NfcTagRow | null>;
  setSelfService(id: string, businessId: string, enabled: boolean): Promise<NfcTagRow | null>;
  updateToken(id: string, businessId: string, token: string): Promise<NfcTagRow | null>;
  /**
   * Resolves an active gallo's context, but only when its branch AND business
   * are also active — one query, one safe outcome for every "unavailable"
   * reason. Excludes `tableName` — NfcTagsService fills that in via
   * TableNamesService, since it's a separate concern the repository layer
   * shouldn't reach across modules for.
   */
  findActiveByToken(
    token: string,
  ): Promise<Omit<PublicNfcResolution, 'tableName'> | null>;
}

export const NFC_TAGS_REPOSITORY = Symbol('NFC_TAGS_REPOSITORY');
