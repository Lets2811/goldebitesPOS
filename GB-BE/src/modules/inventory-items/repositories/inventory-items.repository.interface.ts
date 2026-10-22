import { DbClient } from '../../../database/types/database.types';
import { InventoryItemRow } from '../domain/inventory-item.interface';
import {
  CreateInventoryItemData,
  InventoryItemQuery,
  UpdateInventoryItemData,
} from '../domain/inventory-item.types';
import {
  InventoryQueryAggregateResult,
  InventoryQueryResultRow,
  RunInventoryQueryData,
} from '../domain/inventory-query.types';

export interface IInventoryItemsRepository {
  create(
    data: CreateInventoryItemData,
    client?: DbClient,
  ): Promise<InventoryItemRow>;
  findById(
    id: string,
    businessId: string,
    client?: DbClient,
  ): Promise<InventoryItemRow | null>;
  findAll(
    query: InventoryItemQuery,
  ): Promise<{ rows: InventoryItemRow[]; total: number }>;
  update(
    id: string,
    businessId: string,
    data: UpdateInventoryItemData,
    client?: DbClient,
  ): Promise<InventoryItemRow | null>;
  setActive(
    id: string,
    businessId: string,
    isActive: boolean,
  ): Promise<InventoryItemRow | null>;
  softDelete(id: string, businessId: string): Promise<InventoryItemRow | null>;
  existsBySku(
    branchId: string,
    sku: string,
    excludeId?: string,
  ): Promise<boolean>;
  queryAdvanced(
    data: RunInventoryQueryData,
  ): Promise<{ rows: InventoryQueryResultRow[]; total: number }>;
  queryAggregate(
    data: Omit<RunInventoryQueryData, 'page' | 'limit'>,
  ): Promise<InventoryQueryAggregateResult>;
}

export const INVENTORY_ITEMS_REPOSITORY = Symbol('INVENTORY_ITEMS_REPOSITORY');
