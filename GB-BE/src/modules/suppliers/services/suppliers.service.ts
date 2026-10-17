import { Inject, Injectable } from '@nestjs/common';
import { EntityNotFoundException } from '../../../common/exceptions';
import { PaginatedResult } from '../../../common/pagination/paginated-result.interface';
import { buildPaginationMeta } from '../../../common/pagination/pagination.util';
import { AuditService } from '../../audit/services/audit.service';
import { Supplier, SupplierRow } from '../domain/supplier.interface';
import {
  CreateSupplierData,
  SupplierQuery,
  UpdateSupplierData,
} from '../domain/supplier.types';
import { SupplierMapper } from '../mappers/supplier.mapper';
import { SUPPLIERS_REPOSITORY } from '../repositories/suppliers.repository.interface';
import type { ISuppliersRepository } from '../repositories/suppliers.repository.interface';

@Injectable()
export class SuppliersService {
  constructor(
    @Inject(SUPPLIERS_REPOSITORY)
    private readonly suppliersRepository: ISuppliersRepository,
    private readonly auditService: AuditService,
  ) {}

  async create(
    data: CreateSupplierData,
    actorUserId?: string,
  ): Promise<Supplier> {
    const row = await this.suppliersRepository.create(data);
    await this.auditService.record({
      businessId: data.businessId,
      userId: actorUserId,
      entityType: 'supplier',
      entityId: row.id,
      action: 'CREATE',
      newValues: { name: row.name },
    });
    return SupplierMapper.toDomain(row);
  }

  /**
   * The supplier a purchase names in free text: the active one already called
   * that (so typing it again doesn't duplicate it), or a new one.
   */
  async findOrCreateByName(businessId: string, name: string, actorUserId?: string): Promise<Supplier> {
    const existing = await this.suppliersRepository.findActiveByName(businessId, name);
    if (existing) return SupplierMapper.toDomain(existing);
    return this.create({ businessId, name: name.trim() }, actorUserId);
  }

  async findAll(query: SupplierQuery): Promise<PaginatedResult<Supplier>> {
    const { rows, total } = await this.suppliersRepository.findAll(query);
    return {
      data: rows.map((row) => SupplierMapper.toDomain(row)),
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  async findOne(businessId: string, id: string): Promise<Supplier> {
    const row = await this.getOwnedOrFail(businessId, id);
    return SupplierMapper.toDomain(row);
  }

  async update(
    businessId: string,
    id: string,
    data: UpdateSupplierData,
    actorUserId?: string,
  ): Promise<Supplier> {
    await this.getOwnedOrFail(businessId, id);
    const row = await this.suppliersRepository.update(id, businessId, data);
    if (!row) {
      throw new EntityNotFoundException('Supplier', id);
    }
    await this.auditService.record({
      businessId,
      userId: actorUserId,
      entityType: 'supplier',
      entityId: id,
      action: 'UPDATE',
      newValues: data as Record<string, unknown>,
    });
    return SupplierMapper.toDomain(row);
  }

  async setActive(
    businessId: string,
    id: string,
    isActive: boolean,
    actorUserId?: string,
  ): Promise<Supplier> {
    await this.getOwnedOrFail(businessId, id);
    const row = await this.suppliersRepository.setActive(
      id,
      businessId,
      isActive,
    );
    if (!row) {
      throw new EntityNotFoundException('Supplier', id);
    }
    await this.auditService.record({
      businessId,
      userId: actorUserId,
      entityType: 'supplier',
      entityId: id,
      action: isActive ? 'ACTIVATE' : 'DEACTIVATE',
    });
    return SupplierMapper.toDomain(row);
  }

  private async getOwnedOrFail(
    businessId: string,
    id: string,
  ): Promise<SupplierRow> {
    const row = await this.suppliersRepository.findById(id, businessId);
    if (!row) {
      throw new EntityNotFoundException('Supplier', id);
    }
    return row;
  }
}
