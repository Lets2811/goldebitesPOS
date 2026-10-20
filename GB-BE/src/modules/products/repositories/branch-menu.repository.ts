import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service';
import { DbClient } from '../../../database/types/database.types';

export interface BranchMenuRow {
  product_id: string;
  sale_price: string;
  /** Belongs to the branch asked about (always true without one). */
  is_available: boolean;
  /** Its recipe can't be made once with its branch's stock. */
  out_of_stock: boolean;
}

@Injectable()
export class BranchMenuRepository {
  constructor(private readonly db: DatabaseService) {}

  /**
   * The business's products as a branch sells them: each belongs to one
   * branch, and runs out when it tracks inventory and some ingredient of its
   * recipe has less stock at its branch than one unit takes.
   */
  async forBranch(
    businessId: string,
    branchId: string | null,
    productIds?: string[],
    client?: DbClient,
  ): Promise<BranchMenuRow[]> {
    const params: unknown[] = [businessId, branchId];
    let productFilter = '';
    if (productIds) {
      params.push(productIds);
      productFilter = ` AND p.id = ANY($${params.length}::uuid[])`;
    }
    const result = await this.db.query<BranchMenuRow>(
      `SELECT p.id AS product_id,
              p.sale_price::text AS sale_price,
              ($2::uuid IS NULL OR p.branch_id = $2::uuid) AS is_available,
              (p.track_inventory AND EXISTS (
                SELECT 1
                FROM recipes r
                JOIN recipe_items ri ON ri.recipe_id = r.id
                WHERE r.product_id = p.id AND r.yield_quantity > 0
                  AND COALESCE((
                    SELECT SUM(sv.stock) FROM inventory_stock_view sv
                    WHERE sv.business_id = $1 AND sv.branch_id = p.branch_id
                      AND sv.inventory_item_id = ri.inventory_item_id
                  ), 0) < ri.quantity / r.yield_quantity
              )) AS out_of_stock
       FROM products p
       WHERE p.business_id = $1 AND p.deleted_at IS NULL${productFilter}`,
      params,
      client,
    );
    return result.rows;
  }
}
