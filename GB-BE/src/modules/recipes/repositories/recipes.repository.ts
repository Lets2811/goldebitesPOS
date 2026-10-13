import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service';
import { DbClient } from '../../../database/types/database.types';
import {
  ProductInventoryLinkRow,
  RecipeItemDetailRow,
  RecipeRow,
} from '../domain/recipe.interface';
import {
  CreateRecipeData,
  RecipeItemInput,
  UpdateRecipeData,
} from '../domain/recipe.types';
import { IRecipesRepository } from './recipes.repository.interface';

const SELECT_COLUMNS = `id, business_id, product_id, name, yield_quantity, instructions, created_at, updated_at`;

interface TotalCostRow {
  total_cost: string;
}

@Injectable()
export class RecipesRepository implements IRecipesRepository {
  constructor(private readonly db: DatabaseService) {}

  async create(data: CreateRecipeData, client?: DbClient): Promise<RecipeRow> {
    const result = await this.db.query<RecipeRow>(
      `INSERT INTO recipes (business_id, product_id, name, yield_quantity, instructions)
       VALUES ($1, $2, $3, COALESCE($4::numeric, 1), $5)
       RETURNING ${SELECT_COLUMNS}`,
      [
        data.businessId,
        data.productId,
        data.name,
        data.yieldQuantity ?? null,
        data.instructions ?? null,
      ],
      client,
    );
    return result.rows[0];
  }

  async findByProductId(
    productId: string,
    businessId: string,
    client?: DbClient,
  ): Promise<RecipeRow | null> {
    const result = await this.db.query<RecipeRow>(
      `SELECT ${SELECT_COLUMNS} FROM recipes WHERE product_id = $1 AND business_id = $2`,
      [productId, businessId],
      client,
    );
    return result.rows[0] ?? null;
  }

  async findById(
    id: string,
    businessId: string,
    client?: DbClient,
  ): Promise<RecipeRow | null> {
    const result = await this.db.query<RecipeRow>(
      `SELECT ${SELECT_COLUMNS} FROM recipes WHERE id = $1 AND business_id = $2`,
      [id, businessId],
      client,
    );
    return result.rows[0] ?? null;
  }

  async update(
    id: string,
    businessId: string,
    data: UpdateRecipeData,
    client?: DbClient,
  ): Promise<RecipeRow | null> {
    const result = await this.db.query<RecipeRow>(
      `UPDATE recipes
       SET name = COALESCE($3, name),
           yield_quantity = COALESCE($4, yield_quantity),
           instructions = COALESCE($5, instructions)
       WHERE id = $1 AND business_id = $2
       RETURNING ${SELECT_COLUMNS}`,
      [
        id,
        businessId,
        data.name ?? null,
        data.yieldQuantity ?? null,
        data.instructions ?? null,
      ],
      client,
    );
    return result.rows[0] ?? null;
  }

  async delete(
    id: string,
    businessId: string,
    client?: DbClient,
  ): Promise<boolean> {
    const result = await this.db.query(
      'DELETE FROM recipes WHERE id = $1 AND business_id = $2',
      [id, businessId],
      client,
    );
    return result.rowCount > 0;
  }

  async findItemsWithDetails(
    recipeId: string,
    client?: DbClient,
  ): Promise<RecipeItemDetailRow[]> {
    const result = await this.db.query<RecipeItemDetailRow>(
      `SELECT ri.id, ri.recipe_id, ri.inventory_item_id, ri.quantity, ri.created_at,
              ii.name AS inventory_item_name, ii.unit, ii.current_cost AS unit_cost
       FROM recipe_items ri
       JOIN inventory_items ii ON ii.id = ri.inventory_item_id
       WHERE ri.recipe_id = $1
       ORDER BY ii.name`,
      [recipeId],
      client,
    );
    return result.rows;
  }

  async replaceItems(
    recipeId: string,
    items: RecipeItemInput[],
    client?: DbClient,
  ): Promise<void> {
    await this.db.query(
      'DELETE FROM recipe_items WHERE recipe_id = $1',
      [recipeId],
      client,
    );

    if (items.length === 0) {
      return;
    }

    await this.db.query(
      `INSERT INTO recipe_items (recipe_id, inventory_item_id, quantity)
       SELECT $1, unnest($2::uuid[]), unnest($3::numeric[])`,
      [
        recipeId,
        items.map((item) => item.inventoryItemId),
        items.map((item) => item.quantity),
      ],
      client,
    );
  }

  async findInventoryLinksByProductIds(
    businessId: string,
    productIds: string[],
  ): Promise<ProductInventoryLinkRow[]> {
    if (productIds.length === 0) {
      return [];
    }
    const result = await this.db.query<ProductInventoryLinkRow>(
      `SELECT r.product_id, ri.inventory_item_id, ii.name AS inventory_item_name, ii.unit,
              ri.quantity, r.yield_quantity,
              (ii.deleted_at IS NULL AND ii.is_active) AS inventory_item_available
       FROM recipes r
       JOIN recipe_items ri ON ri.recipe_id = r.id
       JOIN inventory_items ii ON ii.id = ri.inventory_item_id
       WHERE r.business_id = $1 AND r.product_id = ANY($2::uuid[])
       ORDER BY r.product_id, ii.name`,
      [businessId, productIds],
    );
    return result.rows;
  }

  async getTotalCost(recipeId: string, client?: DbClient): Promise<number> {
    const result = await this.db.query<TotalCostRow>(
      `SELECT COALESCE(SUM(ri.quantity * ii.current_cost), 0)::text AS total_cost
       FROM recipe_items ri
       JOIN inventory_items ii ON ii.id = ri.inventory_item_id
       WHERE ri.recipe_id = $1`,
      [recipeId],
      client,
    );
    return parseFloat(result.rows[0]?.total_cost ?? '0');
  }
}
