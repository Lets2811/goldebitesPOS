import { Inject, Injectable } from '@nestjs/common';
import {
  ConflictException,
  EntityNotFoundException,
} from '../../../common/exceptions';
import { DbClient } from '../../../database/types/database.types';
import { TransactionService } from '../../../database/transaction.service';
import { AuditService } from '../../audit/services/audit.service';
import { InventoryItemsService } from '../../inventory-items/services/inventory-items.service';
import { ProductsService } from '../../products/services/products.service';
import {
  ProductInventoryLink,
  RecipeRow,
  RecipeWithItems,
} from '../domain/recipe.interface';
import {
  CreateRecipeData,
  RecipeItemInput,
  UpdateRecipeData,
} from '../domain/recipe.types';
import { RecipeMapper } from '../mappers/recipe.mapper';
import { RECIPES_REPOSITORY } from '../repositories/recipes.repository.interface';
import type { IRecipesRepository } from '../repositories/recipes.repository.interface';

@Injectable()
export class RecipesService {
  constructor(
    @Inject(RECIPES_REPOSITORY)
    private readonly recipesRepository: IRecipesRepository,
    private readonly productsService: ProductsService,
    private readonly inventoryItemsService: InventoryItemsService,
    private readonly transactionService: TransactionService,
    private readonly auditService: AuditService,
  ) {}

  async create(
    data: CreateRecipeData,
    items: RecipeItemInput[] = [],
    actorUserId?: string,
  ): Promise<RecipeWithItems> {
    const product = await this.productsService.getOwnedOrFail(
      data.businessId,
      data.productId,
    );

    const existing = await this.recipesRepository.findByProductId(
      data.productId,
      data.businessId,
    );
    if (existing) {
      throw new ConflictException(
        'This product already has a recipe. Update the existing one instead.',
        'RECIPE_ALREADY_EXISTS',
      );
    }

    await this.assertItemsOwnedByBusiness(data.businessId, items);

    const recipeData = { ...data, name: data.name ?? product.name };

    const recipe = await this.transactionService.execute(async (client) => {
      const row = await this.recipesRepository.create(recipeData, client);
      if (items.length > 0) {
        await this.recipesRepository.replaceItems(row.id, items, client);
        await this.syncProductCost(
          data.businessId,
          data.productId,
          row.id,
          client,
        );
      }
      return row;
    });

    await this.auditService.record({
      businessId: data.businessId,
      userId: actorUserId,
      entityType: 'recipe',
      entityId: recipe.id,
      action: 'CREATE',
      newValues: { productId: data.productId, name: recipe.name },
    });

    return this.buildRecipeWithItems(recipe);
  }

  async findByProduct(
    businessId: string,
    productId: string,
  ): Promise<RecipeWithItems> {
    const recipe = await this.getOwnedRecipeByProductOrFail(
      businessId,
      productId,
    );
    return this.buildRecipeWithItems(recipe);
  }

  /** Used by OrdersService: returns null instead of throwing when the product has no recipe yet. */
  async findByProductOrNull(
    businessId: string,
    productId: string,
  ): Promise<RecipeWithItems | null> {
    const row = await this.recipesRepository.findByProductId(
      productId,
      businessId,
    );
    return row ? this.buildRecipeWithItems(row) : null;
  }

  /**
   * What each of these products consumes from inventory, keyed by product.
   * A product missing from the map has no recipe (or an empty one), so
   * selling it moves no stock.
   */
  async findInventoryLinksByProducts(
    businessId: string,
    productIds: string[],
  ): Promise<Map<string, ProductInventoryLink[]>> {
    const rows = await this.recipesRepository.findInventoryLinksByProductIds(
      businessId,
      productIds,
    );
    const byProduct = new Map<string, ProductInventoryLink[]>();
    for (const row of rows) {
      const links = byProduct.get(row.product_id) ?? [];
      links.push({
        productId: row.product_id,
        inventoryItemId: row.inventory_item_id,
        inventoryItemName: row.inventory_item_name,
        unit: row.unit,
        quantityPerUnit:
          parseFloat(row.quantity) / parseFloat(row.yield_quantity),
        inventoryItemAvailable: row.inventory_item_available,
      });
      byProduct.set(row.product_id, links);
    }
    return byProduct;
  }

  async update(
    businessId: string,
    productId: string,
    data: UpdateRecipeData,
    actorUserId?: string,
  ): Promise<RecipeWithItems> {
    const existing = await this.getOwnedRecipeByProductOrFail(
      businessId,
      productId,
    );

    const row = await this.recipesRepository.update(
      existing.id,
      businessId,
      data,
    );
    if (!row) {
      throw new EntityNotFoundException('Recipe', existing.id);
    }

    await this.auditService.record({
      businessId,
      userId: actorUserId,
      entityType: 'recipe',
      entityId: row.id,
      action: 'UPDATE',
      newValues: data as Record<string, unknown>,
    });

    return this.buildRecipeWithItems(row);
  }

  async setItems(
    businessId: string,
    productId: string,
    items: RecipeItemInput[],
    actorUserId?: string,
  ): Promise<RecipeWithItems> {
    const recipe = await this.getOwnedRecipeByProductOrFail(
      businessId,
      productId,
    );
    await this.assertItemsOwnedByBusiness(businessId, items);

    await this.transactionService.execute(async (client) => {
      await this.recipesRepository.replaceItems(recipe.id, items, client);
      await this.syncProductCost(businessId, productId, recipe.id, client);
    });

    await this.auditService.record({
      businessId,
      userId: actorUserId,
      entityType: 'recipe',
      entityId: recipe.id,
      action: 'SET_ITEMS',
      newValues: { itemCount: items.length },
    });

    return this.buildRecipeWithItems(recipe);
  }

  async remove(
    businessId: string,
    productId: string,
    actorUserId?: string,
  ): Promise<void> {
    const recipe = await this.getOwnedRecipeByProductOrFail(
      businessId,
      productId,
    );
    await this.recipesRepository.delete(recipe.id, businessId);
    await this.auditService.record({
      businessId,
      userId: actorUserId,
      entityType: 'recipe',
      entityId: recipe.id,
      action: 'DELETE',
    });
  }

  private async syncProductCost(
    businessId: string,
    productId: string,
    recipeId: string,
    client: DbClient,
  ): Promise<void> {
    const totalCost = await this.recipesRepository.getTotalCost(
      recipeId,
      client,
    );
    await this.productsService.syncCostFromRecipe(
      businessId,
      productId,
      totalCost,
      client,
    );
  }

  private async assertItemsOwnedByBusiness(
    businessId: string,
    items: RecipeItemInput[],
  ): Promise<void> {
    const uniqueIds = new Set(items.map((item) => item.inventoryItemId));
    if (uniqueIds.size !== items.length) {
      throw new ConflictException(
        'An inventory item cannot appear more than once in the same recipe',
        'DUPLICATE_RECIPE_ITEM',
      );
    }
    for (const item of items) {
      await this.inventoryItemsService.getOwnedOrFail(
        businessId,
        item.inventoryItemId,
      );
    }
  }

  private async getOwnedRecipeByProductOrFail(
    businessId: string,
    productId: string,
  ): Promise<RecipeRow> {
    await this.productsService.getOwnedOrFail(businessId, productId);
    const row = await this.recipesRepository.findByProductId(
      productId,
      businessId,
    );
    if (!row) {
      throw new EntityNotFoundException('Recipe for product', productId);
    }
    return row;
  }

  private async buildRecipeWithItems(row: RecipeRow): Promise<RecipeWithItems> {
    const itemRows = await this.recipesRepository.findItemsWithDetails(row.id);
    const items = itemRows.map((itemRow) => RecipeMapper.itemToDomain(itemRow));
    const totalCost = round2(
      items.reduce((sum, item) => sum + item.lineCost, 0),
    );
    const yieldQuantity = parseFloat(row.yield_quantity);
    const costPerPortion =
      yieldQuantity > 0 ? round2(totalCost / yieldQuantity) : 0;

    return {
      ...RecipeMapper.toDomain(row),
      items,
      cost: { totalCost, costPerPortion, yieldQuantity },
    };
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
