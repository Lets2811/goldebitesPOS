import { Inject, Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { ConflictException, EntityNotFoundException } from '../../../common/exceptions';
import { AuditService } from '../../audit/services/audit.service';
import { BranchesService } from '../../branches/services/branches.service';
import { TableNamesService } from '../../table-names/services/table-names.service';
import { NfcTag, PublicNfcResolution } from '../domain/nfc-tag.interface';
import { CreateNfcTagData, UpdateNfcTagData } from '../domain/nfc-tag.types';
import { NfcTagMapper } from '../mappers/nfc-tag.mapper';
import { NFC_TAGS_REPOSITORY } from '../repositories/nfc-tags.repository.interface';
import type { INfcTagsRepository } from '../repositories/nfc-tags.repository.interface';

/** Public lookup key, not a credential (ticket: "no se considera autenticación del cliente") — stored raw, not hashed. 24 bytes -> 32 url-safe chars, unguessable. */
function generateToken(): string {
  return randomBytes(24).toString('base64url');
}

@Injectable()
export class NfcTagsService {
  constructor(
    @Inject(NFC_TAGS_REPOSITORY)
    private readonly nfcTagsRepository: INfcTagsRepository,
    private readonly branchesService: BranchesService,
    private readonly auditService: AuditService,
    private readonly tableNamesService: TableNamesService,
  ) {}

  async register(data: CreateNfcTagData): Promise<NfcTag> {
    await this.branchesService.findOne(data.businessId, data.branchId);
    await this.assertTableFree(data.branchId, data.tableNumber);

    const row = await this.nfcTagsRepository.create({ ...data, token: generateToken() });
    await this.auditService.record({
      businessId: data.businessId,
      branchId: data.branchId,
      userId: data.actorUserId,
      entityType: 'nfc_tag',
      entityId: row.id,
      action: 'CREATE',
      newValues: { name: row.name, tableNumber: row.table_number },
    });
    return NfcTagMapper.toDomain(row);
  }

  async findAllByBranch(businessId: string, branchId: string): Promise<NfcTag[]> {
    await this.branchesService.findOne(businessId, branchId);
    const rows = await this.nfcTagsRepository.findAllByBranch(businessId, branchId);
    return rows.map((row) => NfcTagMapper.toDomain(row));
  }

  async update(
    businessId: string,
    id: string,
    data: UpdateNfcTagData,
    actorUserId?: string,
  ): Promise<NfcTag> {
    const existing = await this.getOwnedOrFail(businessId, id);

    const targetBranchId = data.branchId ?? existing.branch_id;
    const targetTableNumber = data.tableNumber ?? existing.table_number;
    if (data.branchId) {
      await this.branchesService.findOne(businessId, data.branchId);
    }
    if (data.branchId || data.tableNumber) {
      await this.assertTableFree(targetBranchId, targetTableNumber, id);
    }

    const row = await this.nfcTagsRepository.update(id, businessId, data);
    if (!row) {
      throw new EntityNotFoundException('NfcTag', id);
    }
    await this.auditService.record({
      businessId,
      branchId: targetBranchId,
      userId: actorUserId,
      entityType: 'nfc_tag',
      entityId: id,
      action: 'UPDATE',
      oldValues: { branchId: existing.branch_id, tableNumber: existing.table_number, name: existing.name },
      newValues: { branchId: targetBranchId, tableNumber: targetTableNumber, name: data.name ?? existing.name },
    });
    return NfcTagMapper.toDomain(row);
  }

  async setActive(
    businessId: string,
    id: string,
    isActive: boolean,
    actorUserId?: string,
  ): Promise<NfcTag> {
    await this.getOwnedOrFail(businessId, id);
    const row = await this.nfcTagsRepository.setActive(id, businessId, isActive);
    if (!row) {
      throw new EntityNotFoundException('NfcTag', id);
    }
    await this.auditService.record({
      businessId,
      branchId: row.branch_id,
      userId: actorUserId,
      entityType: 'nfc_tag',
      entityId: id,
      action: isActive ? 'ACTIVATE' : 'DEACTIVATE',
    });
    return NfcTagMapper.toDomain(row);
  }

  async setSelfService(
    businessId: string,
    id: string,
    enabled: boolean,
    actorUserId?: string,
  ): Promise<NfcTag> {
    const existing = await this.getOwnedOrFail(businessId, id);
    const row = await this.nfcTagsRepository.setSelfService(id, businessId, enabled);
    if (!row) {
      throw new EntityNotFoundException('NfcTag', id);
    }
    await this.auditService.record({
      businessId,
      branchId: row.branch_id,
      userId: actorUserId,
      entityType: 'nfc_tag',
      entityId: id,
      action: 'UPDATE',
      oldValues: { selfServiceEnabled: existing.self_service_enabled },
      newValues: { selfServiceEnabled: enabled },
    });
    return NfcTagMapper.toDomain(row);
  }

  async regenerateToken(businessId: string, id: string, actorUserId?: string): Promise<NfcTag> {
    const existing = await this.getOwnedOrFail(businessId, id);
    const row = await this.nfcTagsRepository.updateToken(id, businessId, generateToken());
    if (!row) {
      throw new EntityNotFoundException('NfcTag', id);
    }
    // Deliberately never logs the token value itself — only that a rotation happened.
    await this.auditService.record({
      businessId,
      branchId: existing.branch_id,
      userId: actorUserId,
      entityType: 'nfc_tag',
      entityId: id,
      action: 'REGENERATE_TOKEN',
    });
    return NfcTagMapper.toDomain(row);
  }

  /** Public, unauthenticated lookup — same outcome (not found) whether the token never existed, the gallo is inactive, or its branch/business is inactive. */
  async resolvePublic(token: string): Promise<PublicNfcResolution> {
    const resolution = await this.nfcTagsRepository.findActiveByToken(token);
    if (!resolution) {
      throw new EntityNotFoundException('NfcTag', token);
    }
    const tableName = await this.tableNamesService.findName(
      resolution.businessId,
      resolution.branchId,
      resolution.tableNumber,
    );
    return { ...resolution, tableName };
  }

  private async assertTableFree(branchId: string, tableNumber: string, excludeId?: string): Promise<void> {
    const taken = await this.nfcTagsRepository.existsForBranchTable(branchId, tableNumber, excludeId);
    if (taken) {
      throw new ConflictException(
        `Table "${tableNumber}" already has an NFC tag registered for this branch`,
        'NFC_TAG_TABLE_TAKEN',
      );
    }
  }

  private async getOwnedOrFail(businessId: string, id: string) {
    const row = await this.nfcTagsRepository.findById(id, businessId);
    if (!row) {
      throw new EntityNotFoundException('NfcTag', id);
    }
    return row;
  }
}
