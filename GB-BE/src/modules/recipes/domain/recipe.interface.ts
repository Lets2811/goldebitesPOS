export interface Recipe {
  id: string;
  businessId: string;
  productId: string;
  name: string;
  yieldQuantity: number;
  instructions: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RecipeRow {
  id: string;
  business_id: string;
  product_id: string;
  name: string;
  yield_quantity: string;
  instructions: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface RecipeItem {
  id: string;
  recipeId: string;
  inventoryItemId: string;
  quantity: number;
  createdAt: Date;
}

export interface RecipeItemDetailRow {
  id: string;
  recipe_id: string;
  inventory_item_id: string;
  quantity: string;
  created_at: Date;
  inventory_item_name: string;
  unit: string;
  unit_cost: string;
}

export interface RecipeItemDetail extends RecipeItem {
  inventoryItemName: string;
  unit: string;
  unitCost: number;
  lineCost: number;
}

export interface RecipeCost {
  totalCost: number;
  costPerPortion: number;
  yieldQuantity: number;
}

export interface RecipeWithItems extends Recipe {
  items: RecipeItemDetail[];
  cost: RecipeCost;
}

/**
 * One inventory item a product's recipe consumes — the only link there is
 * between a product and inventory. A product has as many of these as its
 * recipe has ingredients, and none when it has no recipe.
 */
export interface ProductInventoryLink {
  productId: string;
  inventoryItemId: string;
  inventoryItemName: string;
  unit: string;
  /** How much of the item one sold unit consumes: the recipe quantity over its yield, as OrdersService deducts it. */
  quantityPerUnit: number;
  /** False once the inventory item was deleted or deactivated: the recipe still points at it. */
  inventoryItemAvailable: boolean;
}

export interface ProductInventoryLinkRow {
  product_id: string;
  inventory_item_id: string;
  inventory_item_name: string;
  unit: string;
  quantity: string;
  yield_quantity: string;
  inventory_item_available: boolean;
}
