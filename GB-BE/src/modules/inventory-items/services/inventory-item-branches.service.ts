import { Injectable } from '@nestjs/common';
import { EntityNotFoundException } from '../../../common/exceptions';
import { DatabaseService } from '../../../database/database.service';
import { AuditService } from '../../audit/services/audit.service';
import { InventoryItemsService } from './inventory-items.service';

/** An inventory item at one branch: its stock there and the minimum it is held to. */
export interface InventoryItemAtBranch {
  branchId: string;
  branchName: string;
  stock: number;
  /** The branch's own minimum; null: the item's general one. */
  minimumStock: number | null;
  /** What the branch is held to: its own minimum, or the general one. */
  effectiveMinimum: number;
}

interface ItemAtBranchRow {
  branch_id: string;
  branch_name: string;
  stock: string;
  own_minimum: string | null;
  general_minimum: string;
}

/**
 * Each branch keeps its own stock and can be held to its own minimum: a big
 * branch and a small one don't run low at the same point.
 */
@Injectable()
export class InventoryItemBranchesService {
  constructor(
    private readonly db: DatabaseService,
    private readonly inventoryItemsService: InventoryItemsService,
    private readonly auditService: AuditService,
  ) {}

  async findForItem(
    businessId: string,
    itemId: string,
  ): Promise<InventoryItemAtBranch[]> {
    await this.inventoryItemsService.findOne(businessId, itemId);
    const result = await this.db.query<ItemAtBranchRow>(
      `SELECT b.id AS branch_id, b.name AS branch_name,
              COALESCE((
                SELECT SUM(sv.stock) FROM inventory_stock_view sv
                WHERE sv.business_id = $1 AND sv.branch_id = b.id AND sv.inventory_item_id = $2
              ), 0)::text AS stock,
              ibs.minimum_stock::text AS own_minimum,
              ii.minimum_stock::text AS general_minimum
       FROM branches b
       JOIN inventory_items ii ON ii.id = $2
       LEFT JOIN inventory_item_branch_settings ibs
         ON ibs.inventory_item_id = $2 AND ibs.branch_id = b.id
       WHERE b.business_id = $1 AND b.is_active = true
       ORDER BY b.created_at, b.id`,
      [businessId, itemId],
    );
    return result.rows.map((row) => {
      const own = row.own_minimum !== null ? parseFloat(row.own_minimum) : null;
      return {
        branchId: row.branch_id,
        branchName: row.branch_name,
        stock: parseFloat(row.stock),
        minimumStock: own,
        effectiveMinimum: own ?? parseFloat(row.general_minimum),
      };
    });
  }

  /** The items with a minimum of their own at a branch (the rest use their general one). */
  async minimumsAt(
    businessId: string,
    branchId: string,
  ): Promise<{ inventoryItemId: string; minimumStock: number }[]> {
    const result = await this.db.query<{
      inventory_item_id: string;
      minimum_stock: string;
    }>(
      `SELECT ibs.inventory_item_id, ibs.minimum_stock::text AS minimum_stock
       FROM inventory_item_branch_settings ibs
       JOIN inventory_items ii ON ii.id = ibs.inventory_item_id
       WHERE ii.business_id = $1 AND ibs.branch_id = $2`,
      [businessId, branchId],
    );
    return result.rows.map((row) => ({
      inventoryItemId: row.inventory_item_id,
      minimumStock: parseFloat(row.minimum_stock),
    }));
  }

  /** Sets a branch's own minimum for the item; null goes back to the general one. */
  async setMinimum(
    businessId: string,
    itemId: string,
    branchId: string,
    minimumStock: number | null,
    actorUserId?: string,
  ): Promise<InventoryItemAtBranch[]> {
    await this.inventoryItemsService.findOne(businessId, itemId);
    const branch = await this.db.query<{ id: string }>(
      'SELECT id FROM branches WHERE id = $1 AND business_id = $2 AND is_active = true',
      [branchId, businessId],
    );
    if (branch.rows.length === 0) {
      throw new EntityNotFoundException('Branch', branchId);
    }
    if (minimumStock === null) {
      await this.db.query(
        'DELETE FROM inventory_item_branch_settings WHERE inventory_item_id = $1 AND branch_id = $2',
        [itemId, branchId],
      );
    } else {
      await this.db.query(
        `INSERT INTO inventory_item_branch_settings (inventory_item_id, branch_id, minimum_stock)
         VALUES ($1, $2, $3)
         ON CONFLICT (inventory_item_id, branch_id)
         DO UPDATE SET minimum_stock = EXCLUDED.minimum_stock, updated_at = now()`,
        [itemId, branchId, minimumStock],
      );
    }
    await this.auditService.record({
      businessId,
      branchId,
      userId: actorUserId,
      entityType: 'inventory_item',
      entityId: itemId,
      action: 'SET_BRANCH_MINIMUM',
      newValues: { minimumStock },
    });
    return this.findForItem(businessId, itemId);
  }
}
