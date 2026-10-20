import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service';
import { DbClient } from '../../../database/types/database.types';

export interface BranchMenuRow {
  product_id: string;
  /** The branch's price, or the catalog's when it has none. */
  sale_price: string;
  /** The branch's own price, when it has one. */
  branch_sale_price: string | null;
  /** Offered at the branch (false: left out of its menu). */
  is_available: boolean;
  /** Its recipe can't be made once with the branch's stock. */
  out_of_stock: boolean;
}

export interface ProductBranchSettingsInput {
  isAvailable: boolean;
  /** null: the catalog's price. */
  salePrice: number | null;
}

@Injectable()
export class BranchMenuRepository {
  constructor(private readonly db: DatabaseService) {}

  /**
   * How each product of the business sells at a branch: its price there,
   * whether the branch offers it, and whether it ran out. A product runs out
   * when it tracks inventory and some ingredient of its recipe has less stock
   * at the branch than one unit takes. Without a branch (null) nothing is
   * branch-specific: catalog prices, nothing out.
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
              COALESCE(pbs.sale_price, p.sale_price)::text AS sale_price,
              pbs.sale_price::text AS branch_sale_price,
              COALESCE(pbs.is_available, true) AS is_available,
              ($2::uuid IS NOT NULL AND p.track_inventory AND EXISTS (
                SELECT 1
                FROM recipes r
                JOIN recipe_items ri ON ri.recipe_id = r.id
                WHERE r.product_id = p.id AND r.yield_quantity > 0
                  AND COALESCE((
                    SELECT SUM(sv.stock) FROM inventory_stock_view sv
                    WHERE sv.business_id = $1 AND sv.branch_id = $2::uuid
                      AND sv.inventory_item_id = ri.inventory_item_id
                  ), 0) < ri.quantity / r.yield_quantity
              )) AS out_of_stock
       FROM products p
       LEFT JOIN product_branch_settings pbs ON pbs.product_id = p.id AND pbs.branch_id = $2::uuid
       WHERE p.business_id = $1 AND p.deleted_at IS NULL${productFilter}`,
      params,
      client,
    );
    return result.rows;
  }

  /** A product's own settings at each branch that has any. */
  async settingsOf(
    productId: string,
  ): Promise<
    { branch_id: string; is_available: boolean; sale_price: string | null }[]
  > {
    const result = await this.db.query<{
      branch_id: string;
      is_available: boolean;
      sale_price: string | null;
    }>(
      `SELECT branch_id, is_available, sale_price::text AS sale_price
       FROM product_branch_settings WHERE product_id = $1`,
      [productId],
    );
    return result.rows;
  }

  /** Sets how a product sells at a branch; "as in the catalog" leaves no row. */
  async setSettings(
    productId: string,
    branchId: string,
    input: ProductBranchSettingsInput,
  ): Promise<void> {
    if (input.isAvailable && input.salePrice === null) {
      await this.db.query(
        'DELETE FROM product_branch_settings WHERE product_id = $1 AND branch_id = $2',
        [productId, branchId],
      );
      return;
    }
    await this.db.query(
      `INSERT INTO product_branch_settings (product_id, branch_id, is_available, sale_price)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (product_id, branch_id)
       DO UPDATE SET is_available = EXCLUDED.is_available, sale_price = EXCLUDED.sale_price, updated_at = now()`,
      [productId, branchId, input.isAvailable, input.salePrice],
    );
  }
}
