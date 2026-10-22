import { randomUUID } from 'node:crypto';
import { copyFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { Injectable } from '@nestjs/common';
import {
  BusinessRuleException,
  ConflictException,
  EntityNotFoundException,
} from '../../common/exceptions';
import { BranchesService } from '../branches/services/branches.service';
import { InventoryItemRow } from '../inventory-items/domain/inventory-item.interface';
import { InventoryItemsService } from '../inventory-items/services/inventory-items.service';
import { Product } from '../products/domain/product.interface';
import { ProductsService } from '../products/services/products.service';
import { PRODUCT_IMAGES_UPLOADS_DIR } from '../products/storage/product-image-storage.util';
import { RecipeItemInput } from '../recipes/domain/recipe.types';
import { RecipesService } from '../recipes/services/recipes.service';

const sameName = (a: string, b: string) =>
  a.trim().toLocaleLowerCase('es') === b.trim().toLocaleLowerCase('es');

/**
 * Each branch has its own catalog. Bringing a product to another branch makes
 * an independent copy there — its price, photo, options and recipe — so the
 * other branch can change it without touching the original. The recipe uses
 * the target branch's own inventory items: the ones with the same name and
 * unit, or new ones (with no stock yet) when it has none.
 */
@Injectable()
export class BranchCatalogService {
  constructor(
    private readonly productsService: ProductsService,
    private readonly inventoryItemsService: InventoryItemsService,
    private readonly recipesService: RecipesService,
    private readonly branchesService: BranchesService,
  ) {}

  async copyProductToBranch(
    businessId: string,
    productId: string,
    targetBranchId: string,
    actorUserId?: string,
  ): Promise<Product> {
    const source = await this.productsService.getOwnedOrFail(
      businessId,
      productId,
    );
    if (source.branch_id === targetBranchId) {
      throw new BusinessRuleException(
        'El producto ya es de esa sede',
        'PRODUCT_ALREADY_IN_BRANCH',
      );
    }
    if (
      !(await this.branchesService.isActiveBranch(businessId, targetBranchId))
    ) {
      throw new EntityNotFoundException('Branch', targetBranchId);
    }

    const inTarget = await this.productsService.findAll({
      businessId,
      branchId: targetBranchId,
      search: source.name.trim(),
      page: 1,
      limit: 100,
    });
    if (inTarget.data.some((product) => sameName(product.name, source.name))) {
      throw new ConflictException(
        `"${source.name}" ya existe en esa sede`,
        'PRODUCT_ALREADY_IN_BRANCH',
      );
    }
    // A SKU is unique within a branch: kept only when the target has it free.
    const skuTaken =
      source.sku !== null &&
      (
        await this.productsService.findAll({
          businessId,
          branchId: targetBranchId,
          search: source.sku,
          page: 1,
          limit: 100,
        })
      ).data.some((product) => product.sku === source.sku);

    const original = await this.productsService.findOne(businessId, productId);
    const copy = await this.productsService.create(
      {
        businessId,
        branchId: targetBranchId,
        categoryId: source.category_id ?? undefined,
        name: source.name,
        description: source.description ?? undefined,
        sku: skuTaken ? undefined : (source.sku ?? undefined),
        salePrice: parseFloat(source.sale_price),
        imageUrl: source.image_url ?? undefined,
        trackInventory: source.track_inventory,
        optionGroups: original.optionGroups,
        menuAvailability: original.menuAvailability,
      },
      actorUserId,
    );
    if (!source.is_visible) {
      await this.productsService.setVisible(
        businessId,
        copy.id,
        false,
        actorUserId,
      );
    }
    if (!source.is_active) {
      await this.productsService.setActive(
        businessId,
        copy.id,
        false,
        actorUserId,
      );
    }
    await this.copyImage(businessId, source, copy.id, actorUserId);
    await this.copyRecipe(
      businessId,
      productId,
      copy.id,
      targetBranchId,
      actorUserId,
    );
    return this.productsService.findOne(businessId, copy.id);
  }

  /** The photo is its own file for the copy: removing one never removes the other's. */
  private async copyImage(
    businessId: string,
    source: { image_path: string | null; image_mime_type: string | null },
    copyId: string,
    actorUserId?: string,
  ): Promise<void> {
    if (!source.image_path || !source.image_mime_type) return;
    const target = join(
      PRODUCT_IMAGES_UPLOADS_DIR,
      `${randomUUID()}${extname(source.image_path)}`,
    );
    try {
      copyFileSync(source.image_path, target);
    } catch {
      // A photo missing on disk is not worth failing the copy over.
      return;
    }
    await this.productsService.setImage(
      businessId,
      copyId,
      target,
      source.image_mime_type,
      actorUserId,
    );
  }

  private async copyRecipe(
    businessId: string,
    sourceProductId: string,
    copyId: string,
    targetBranchId: string,
    actorUserId?: string,
  ): Promise<void> {
    const recipe = await this.recipesService.findByProductOrNull(
      businessId,
      sourceProductId,
    );
    if (!recipe) return;

    const items: RecipeItemInput[] = [];
    for (const ingredient of recipe.items) {
      const sourceItem = await this.inventoryItemsService.getOwnedOrFail(
        businessId,
        ingredient.inventoryItemId,
      );
      const targetItem = await this.itemInBranch(
        businessId,
        sourceItem,
        targetBranchId,
        actorUserId,
      );
      if (!items.some((item) => item.inventoryItemId === targetItem)) {
        items.push({
          inventoryItemId: targetItem,
          quantity: ingredient.quantity,
        });
      }
    }
    await this.recipesService.create(
      {
        businessId,
        productId: copyId,
        name: recipe.name,
        yieldQuantity: recipe.yieldQuantity,
        instructions: recipe.instructions ?? undefined,
      },
      items,
      actorUserId,
    );
  }

  /** The target branch's item with the same name and unit, or a new one there (no stock yet). */
  private async itemInBranch(
    businessId: string,
    sourceItem: InventoryItemRow,
    targetBranchId: string,
    actorUserId?: string,
  ): Promise<string> {
    const candidates = await this.inventoryItemsService.findAll({
      businessId,
      branchId: targetBranchId,
      search: sourceItem.name.trim(),
      page: 1,
      limit: 100,
    });
    const existing = candidates.data.find(
      (item) =>
        sameName(item.name, sourceItem.name) && item.unit === sourceItem.unit,
    );
    if (existing) return existing.id;

    const created = await this.inventoryItemsService.create(
      {
        businessId,
        branchId: targetBranchId,
        categoryId: sourceItem.category_id ?? undefined,
        name: sourceItem.name,
        unit: sourceItem.unit,
        minimumStock: parseFloat(sourceItem.minimum_stock),
        currentCost: parseFloat(sourceItem.current_cost),
        brand: sourceItem.brand ?? undefined,
        model: sourceItem.model ?? undefined,
      },
      actorUserId,
    );
    return created.id;
  }
}
