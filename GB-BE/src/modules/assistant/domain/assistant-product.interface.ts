/**
 * How a product relates to inventory, as far as the POS can tell.
 *
 * A product never points at an inventory item directly: the only link is its
 * recipe. `trackInventory` says whether selling it should move stock at all,
 * and the recipe says which items it moves.
 */
export type AssistantProductInventory =
  /** `trackInventory` is off: selling it moves no stock, so stock does not apply. */
  | { controlled: false }
  /**
   * The recipe has exactly one ingredient, so the product is that item sold
   * as is (a bottle of water). `currentStock` is the item's stock in the
   * branch, in the item's own `unit`; one sold unit takes `quantityPerUnit`
   * of it. It is null, with a reason, when it cannot be given.
   */
  | {
      controlled: true;
      mode: 'DIRECT';
      itemId?: string;
      itemName?: string;
      unit?: string;
      quantityPerUnit?: number;
      currentStock: number | null;
      stockUnavailableReason?: StockUnavailableReason;
    }
  /**
   * The recipe has several ingredients. The POS has no rule for how many
   * units they can still make, so there is no single stock to report.
   */
  | {
      controlled: true;
      mode: 'RECIPE';
      ingredientCount: number;
      currentStock: null;
    }
  /** `trackInventory` is on but there is no recipe: nothing is deducted on sale and there is no stock to read. */
  | { controlled: true; mode: 'UNLINKED'; currentStock: null };

export type StockUnavailableReason =
  /** The caller may read products but not inventory. */
  | 'NO_INVENTORY_ACCESS'
  /** Stock is kept per branch and the caller's branch cannot be told. */
  | 'BRANCH_UNKNOWN'
  /** The recipe points at an inventory item that was deleted or deactivated. */
  | 'INVENTORY_ITEM_UNAVAILABLE';

export interface AssistantProduct {
  id: string;
  name: string;
  description: string | null;
  sku: string | null;
  categoryId: string | null;
  salePrice: number;
  isActive: boolean;
  isVisible: boolean;
  inventory: AssistantProductInventory;
}

export interface AssistantProductsResult {
  items: AssistantProduct[];
  /**
   * How many came back; `total` is how many match, which can be more than
   * the limit. When ordered by stock, only products with a known stock are
   * matched at all: the rest have nothing to be ordered by.
   */
  count: number;
  total: number;
  /** The branch the stock figures are for; null when none could be determined. */
  stockBranchId: string | null;
}

export interface AssistantProductsQuery {
  businessId: string;
  /** The caller's branch, straight from their session. */
  branchId: string | null;
  /** Whether the caller may see stock at all (the inventory permission and module). */
  canReadStock: boolean;
  search?: string;
  isActive?: boolean;
  isVisible?: boolean;
  limit: number;
  /** `name` lists the catalog alphabetically; `stock` ranks the products that have a stock figure. */
  sortBy: AssistantProductsSort;
  sortOrder: 'asc' | 'desc';
}

export type AssistantProductsSort = 'name' | 'stock';
