import { Injectable } from '@nestjs/common';
import { EntityNotFoundException } from '../../../common/exceptions';
import { DbClient } from '../../../database/types/database.types';
import { AuditService } from '../../audit/services/audit.service';
import { BranchesService } from '../../branches/services/branches.service';
import {
  BranchMenuRepository,
  ProductBranchSettingsInput,
} from '../repositories/branch-menu.repository';
import { Product } from '../domain/product.interface';
import { ProductsService } from './products.service';

/** How a product sells at one branch. */
export interface BranchMenuEntry {
  /** The branch's price, or the catalog's. */
  salePrice: number;
  /** Offered at the branch at all. */
  isAvailable: boolean;
  /** Its recipe can't be made with the branch's stock. */
  outOfStock: boolean;
}

export interface ProductAtBranch {
  branchId: string;
  branchName: string;
  isAvailable: boolean;
  /** The branch's own price; null: the catalog's. */
  salePrice: number | null;
  outOfStock: boolean;
}

/**
 * Each branch sells from its own menu: the catalog is the business's, but a
 * branch can leave a product out or sell it at its own price, and a product
 * whose recipe the branch has no stock for is sold out there.
 */
@Injectable()
export class BranchMenuService {
  constructor(
    private readonly repository: BranchMenuRepository,
    private readonly productsService: ProductsService,
    private readonly branchesService: BranchesService,
    private readonly auditService: AuditService,
  ) {}

  /** Every product of the business as it sells at a branch (null: no branch, the catalog as is). */
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

  /**
   * What a branch sells: the active products it offers, at its prices, each
   * saying whether it ran out there. Without a branch, the catalog as is.
   */
  async sellingMenu(
    businessId: string,
    branchId: string | null,
  ): Promise<(Product & { outOfStock: boolean })[]> {
    const [products, menu] = await Promise.all([
      this.productsService.findAvailableForSale(businessId),
      this.forBranch(businessId, branchId),
    ]);
    return products.flatMap((product) => {
      const entry = menu.get(product.id);
      if (entry && !entry.isAvailable) return [];
      return [
        {
          ...product,
          salePrice: entry?.salePrice ?? product.salePrice,
          outOfStock: entry?.outOfStock ?? false,
        },
      ];
    });
  }

  /** A product at each active branch of the business. */
  async productBranches(
    businessId: string,
    productId: string,
  ): Promise<ProductAtBranch[]> {
    await this.productsService.findOne(businessId, productId);
    const [branches, settings] = await Promise.all([
      this.branchesService.findAll({
        businessId,
        isActive: true,
        page: 1,
        limit: 200,
      }),
      this.repository.settingsOf(productId),
    ]);
    const byBranch = new Map(settings.map((row) => [row.branch_id, row]));
    const result: ProductAtBranch[] = [];
    for (const branch of branches.data) {
      const own = byBranch.get(branch.id);
      const entry = (
        await this.forBranch(businessId, branch.id, [productId])
      ).get(productId);
      result.push({
        branchId: branch.id,
        branchName: branch.name,
        isAvailable: own?.is_available ?? true,
        salePrice: own?.sale_price != null ? parseFloat(own.sale_price) : null,
        outOfStock: entry?.outOfStock ?? false,
      });
    }
    return result;
  }

  async setProductBranch(
    businessId: string,
    productId: string,
    branchId: string,
    input: ProductBranchSettingsInput,
    actorUserId?: string,
  ): Promise<ProductAtBranch[]> {
    await this.productsService.findOne(businessId, productId);
    if (!(await this.branchesService.isActiveBranch(businessId, branchId))) {
      throw new EntityNotFoundException('Branch', branchId);
    }
    await this.repository.setSettings(productId, branchId, input);
    await this.auditService.record({
      businessId,
      branchId,
      userId: actorUserId,
      entityType: 'product',
      entityId: productId,
      action: 'SET_BRANCH_MENU',
      newValues: { isAvailable: input.isAvailable, salePrice: input.salePrice },
    });
    return this.productBranches(businessId, productId);
  }
}
