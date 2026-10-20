import { Injectable } from '@nestjs/common';
import { DbClient } from '../../../database/types/database.types';
import { Product } from '../domain/product.interface';
import { BranchMenuRepository } from '../repositories/branch-menu.repository';
import { ProductsService } from './products.service';

/** How a product sells at one branch. */
export interface BranchMenuEntry {
  salePrice: number;
  /** It is the branch's (each branch has its own catalog). */
  isAvailable: boolean;
  /** Its recipe can't be made with its branch's stock. */
  outOfStock: boolean;
}

/**
 * What each branch sells: its own catalog, with what it ran out of (no stock
 * left for the recipe) marked, so menus hide it and orders refuse it.
 */
@Injectable()
export class BranchMenuService {
  constructor(
    private readonly repository: BranchMenuRepository,
    private readonly productsService: ProductsService,
  ) {}

  /** The business's products as a branch sells them (null: no branch, all of them). */
  async forBranch(
    businessId: string,
    branchId: string | null,
    productIds?: string[],
    client?: DbClient,
  ): Promise<Map<string, BranchMenuEntry>> {
    const rows = await this.repository.forBranch(
      businessId,
      branchId,
      productIds,
      client,
    );
    return new Map(
      rows.map((row) => [
        row.product_id,
        {
          salePrice: parseFloat(row.sale_price),
          isAvailable: row.is_available,
          outOfStock: row.out_of_stock,
        },
      ]),
    );
  }

  /** What a branch sells: its active products, each saying whether it ran out. Without a branch, every branch's. */
  async sellingMenu(
    businessId: string,
    branchId: string | null,
  ): Promise<(Product & { outOfStock: boolean })[]> {
    const [products, menu] = await Promise.all([
      this.productsService.findAvailableForSale(
        businessId,
        branchId ?? undefined,
      ),
      this.forBranch(businessId, branchId),
    ]);
    return products.map((product) => ({
      ...product,
      outOfStock: menu.get(product.id)?.outOfStock ?? false,
    }));
  }
}
