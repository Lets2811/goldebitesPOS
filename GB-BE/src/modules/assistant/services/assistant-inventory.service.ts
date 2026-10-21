import { Injectable } from '@nestjs/common';
import { UnauthorizedOperationException } from '../../../common/exceptions';
import { InventoryItem } from '../../inventory-items/domain/inventory-item.interface';
import { InventoryItemsService } from '../../inventory-items/services/inventory-items.service';
import { InventoryMovementsService } from '../../inventory-movements/services/inventory-movements.service';
import type { AssistantBranchScope } from './assistant-branch-scope.service';

/** An inventory item as the assistant needs it: enough to name it, its stock and whether it runs low. */
export interface AssistantInventoryItem {
  id: string;
  name: string;
  sku: string | null;
  unit: string;
  isActive: boolean;
  minimumStock: number;
  /** At the item's own branch (each item is one branch's). */
  currentStock: number;
  belowMinimum: boolean;
  branchId: string;
  /** The branch's name, given when the answer covers several. */
  branch?: string;
}

export interface AssistantInventoryQuery {
  businessId: string;
  /** The branch to read; null for every branch the caller may see. */
  branchId: string | null;
  /** Whether items are labelled with their branch's name (the answer covers several). */
  labelBranches: boolean;
  branchNames: Map<string, string>;
  scope: AssistantBranchScope;
  search?: string;
  isActive?: boolean;
  limit: number;
}

/**
 * Inventory items for the assistant, read through the services that own
 * them: the caller's branch's items (each branch has its own) with the stock
 * they have there. It is what lets the assistant find the item a change
 * refers to, by name, and tell what it holds before and after.
 */
@Injectable()
export class AssistantInventoryService {
  constructor(
    private readonly inventoryItemsService: InventoryItemsService,
    private readonly movementsService: InventoryMovementsService,
  ) {}

  async search(query: AssistantInventoryQuery): Promise<{
    items: AssistantInventoryItem[];
    count: number;
    total: number;
    scope: AssistantBranchScope;
  }> {
    const page = await this.inventoryItemsService.findAll({
      businessId: query.businessId,
      branchId: query.branchId ?? undefined,
      search: query.search,
      isActive: query.isActive,
      page: 1,
      limit: query.limit,
    });
    const items = (await this.withStock(query.businessId, page.data)).map(
      (item) =>
        query.labelBranches
          ? {
              ...item,
              branch: query.branchNames.get(item.branchId) ?? item.branchId,
            }
          : item,
    );
    return {
      items,
      count: items.length,
      total: page.meta.total,
      scope: query.scope,
    };
  }

  /** One item; `onlyBranchId` keeps a user tied to a branch to that branch's items. */
  async findOne(
    businessId: string,
    id: string,
    onlyBranchId: string | null = null,
  ): Promise<AssistantInventoryItem> {
    const item = await this.inventoryItemsService.findOne(businessId, id);
    if (onlyBranchId && item.branchId !== onlyBranchId) {
      throw new UnauthorizedOperationException(
        'This item belongs to another branch',
      );
    }
    const [withStock] = await this.withStock(businessId, [item]);
    return withStock;
  }

  /** Each item with the stock it has at its own branch, from one read of the business's levels. */
  private async withStock(
    businessId: string,
    items: InventoryItem[],
  ): Promise<AssistantInventoryItem[]> {
    if (items.length === 0) return [];
    const levels = await this.movementsService.getStock({ businessId });
    const stockOf = new Map<string, number>();
    for (const level of levels) {
      const key = `${level.inventoryItemId}:${level.branchId}`;
      stockOf.set(key, (stockOf.get(key) ?? 0) + level.stock);
    }
    return items.map((item) => {
      const currentStock =
        Math.round((stockOf.get(`${item.id}:${item.branchId}`) ?? 0) * 1000) /
        1000;
      return {
        id: item.id,
        name: item.name,
        sku: item.sku,
        unit: item.unit,
        isActive: item.isActive,
        minimumStock: item.minimumStock,
        currentStock,
        belowMinimum: currentStock < item.minimumStock,
        branchId: item.branchId,
      };
    });
  }
}
