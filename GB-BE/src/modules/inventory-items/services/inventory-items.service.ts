import { Inject, Injectable } from '@nestjs/common';
import {
  ConflictException,
  EntityNotFoundException,
} from '../../../common/exceptions';
import { DbClient } from '../../../database/types/database.types';
import { PaginatedResult } from '../../../common/pagination/paginated-result.interface';
import { buildPaginationMeta } from '../../../common/pagination/pagination.util';
import { AuditService } from '../../audit/services/audit.service';
import {
  InventoryItem,
  InventoryItemRow,
} from '../domain/inventory-item.interface';
import {
  CreateInventoryItemData,
  InventoryItemQuery,
  UpdateInventoryItemData,
} from '../domain/inventory-item.types';
import { InventoryItemMapper } from '../mappers/inventory-item.mapper';
import { INVENTORY_ITEMS_REPOSITORY } from '../repositories/inventory-items.repository.interface';
import type { IInventoryItemsRepository } from '../repositories/inventory-items.repository.interface';

@Injectable()
export class InventoryItemsService {
  constructor(
    @Inject(INVENTORY_ITEMS_REPOSITORY)
    private readonly inventoryItemsRepository: IInventoryItemsRepository,
    private readonly auditService: AuditService,
  ) {}

  async create(
    data: CreateInventoryItemData,
    actorUserId?: string,
  ): Promise<InventoryItem> {
    if (data.sku) {
      await this.assertSkuFree(data.branchId, data.sku);
    }

    const row = await this.inventoryItemsRepository.create(data);
    await this.auditService.record({
      businessId: data.businessId,
      userId: actorUserId,
      entityType: 'inventory_item',
      entityId: row.id,
      action: 'CREATE',
      newValues: { name: row.name, sku: row.sku },
    });
    return InventoryItemMapper.toDomain(row);
  }

  async findAll(
    query: InventoryItemQuery,
  ): Promise<PaginatedResult<InventoryItem>> {
    const { rows, total } = await this.inventoryItemsRepository.findAll(query);
    return {
      data: rows.map((row) => InventoryItemMapper.toDomain(row)),
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  async findOne(businessId: string, id: string): Promise<InventoryItem> {
    const row = await this.getOwnedOrFail(businessId, id);
    return InventoryItemMapper.toDomain(row);
  }

  async update(
    businessId: string,
    id: string,
    data: UpdateInventoryItemData,
    actorUserId?: string,
  ): Promise<InventoryItem> {
    const current = await this.getOwnedOrFail(businessId, id);

    if (data.sku) {
      await this.assertSkuFree(current.branch_id, data.sku, id);
    }

    const row = await this.inventoryItemsRepository.update(
      id,
      businessId,
      data,
    );
    if (!row) {
      throw new EntityNotFoundException('InventoryItem', id);
    }
    await this.auditService.record({
      businessId,
      userId: actorUserId,
      entityType: 'inventory_item',
      entityId: id,
      action: 'UPDATE',
      newValues: data as Record<string, unknown>,
    });
    return InventoryItemMapper.toDomain(row);
  }

  async setActive(
    businessId: string,
    id: string,
    isActive: boolean,
    actorUserId?: string,
  ): Promise<InventoryItem> {
    await this.getOwnedOrFail(businessId, id);
    const row = await this.inventoryItemsRepository.setActive(
      id,
      businessId,
      isActive,
    );
    if (!row) {
      throw new EntityNotFoundException('InventoryItem', id);
    }
    await this.auditService.record({
      businessId,
      userId: actorUserId,
      entityType: 'inventory_item',
      entityId: id,
      action: isActive ? 'ACTIVATE' : 'DEACTIVATE',
    });
    return InventoryItemMapper.toDomain(row);
  }

  async softDelete(
    businessId: string,
    id: string,
    actorUserId?: string,
  ): Promise<void> {
    const row = await this.inventoryItemsRepository.softDelete(id, businessId);
    if (!row) {
      throw new EntityNotFoundException('InventoryItem', id);
    }
    await this.auditService.record({
      businessId,
      userId: actorUserId,
      entityType: 'inventory_item',
      entityId: id,
      action: 'DELETE',
    });
  }

  /** Used by GoodsReceiptsService: the latest purchase cost becomes the item's current_cost. */
  async syncCostFromPurchase(
    businessId: string,
    id: string,
    currentCost: number,
    client?: DbClient,
  ): Promise<void> {
    await this.inventoryItemsRepository.update(
      id,
      businessId,
      { currentCost },
      client,
    );
  }

  /** Used by RecipesService to price recipe items without exposing the repository. */
  async getOwnedOrFail(
    businessId: string,
    id: string,
  ): Promise<InventoryItemRow> {
    const row = await this.inventoryItemsRepository.findById(id, businessId);
    if (!row) {
      throw new EntityNotFoundException('InventoryItem', id);
    }
    return row;
  }

  private async assertSkuFree(
    branchId: string,
    sku: string,
    excludeId?: string,
  ): Promise<void> {
    const taken = await this.inventoryItemsRepository.existsBySku(
      branchId,
      sku,
      excludeId,
    );
    if (taken) {
      throw new ConflictException(
        `SKU "${sku}" is already in use`,
        'INVENTORY_ITEM_SKU_TAKEN',
      );
    }
  }
}
