import { Injectable } from '@nestjs/common';
import {
  BusinessRuleException,
  UnauthorizedOperationException,
} from '../../../common/exceptions';
import { BranchesService } from '../../branches/services/branches.service';
import { InventoryMovementsService } from '../../inventory-movements/services/inventory-movements.service';
import { Product } from '../../products/domain/product.interface';
import { ProductsService } from '../../products/services/products.service';
import {
  BranchMenuEntry,
  BranchMenuService,
} from '../../products/services/branch-menu.service';
import { ProductInventoryLink } from '../../recipes/domain/recipe.interface';
import { RecipesService } from '../../recipes/services/recipes.service';
import {
  AssistantProduct,
  AssistantProductInventory,
  AssistantProductsQuery,
  AssistantProductsResult,
  StockUnavailableReason,
} from '../domain/assistant-product.interface';

/**
 * Products as the assistant needs them: the catalog entry plus what the POS
 * knows about its stock. Read-only, and every figure comes from the service
 * that already owns it — the search from ProductsService, the link to
 * inventory from RecipesService, the stock from InventoryMovementsService.
 */
@Injectable()
export class AssistantProductsService {
  constructor(
    private readonly productsService: ProductsService,
    private readonly recipesService: RecipesService,
    private readonly movementsService: InventoryMovementsService,
    private readonly branchesService: BranchesService,
    private readonly branchMenuService: BranchMenuService,
  ) {}

  /** How the products sell at the caller's branch, when there is one to tell. */
  private async branchMenu(
    query: AssistantProductsQuery,
    products: Product[],
  ): Promise<Map<string, BranchMenuEntry>> {
    const branchId = await this.resolveBranchId(query);
    if (!branchId || products.length === 0) return new Map();
    return this.branchMenuService.forBranch(
      query.businessId,
      branchId,
      products.map((product) => product.id),
    );
  }

  async search(
    query: AssistantProductsQuery,
  ): Promise<AssistantProductsResult> {
    return query.sortBy === 'stock'
      ? this.rankByStock(query)
      : this.listByName(query);
  }

  /**
   * The products that have a stock figure, ordered by it. Stock is not a
   * column that can be sorted in the database — it is derived from the
   * movements of whatever item each recipe points at — so every matching
   * product is read (in pages, not one by one), given its stock from the same
   * two batch lookups the plain listing uses, and ordered here.
   */
  private async rankByStock(
    query: AssistantProductsQuery,
  ): Promise<AssistantProductsResult> {
    if (!query.canReadStock) {
      throw new UnauthorizedOperationException(
        'Ordering products by stock requires access to inventory',
      );
    }
    const stockBranchId = await this.resolveBranchId(query);
    if (!stockBranchId) {
      throw new BusinessRuleException(
        'Stock is kept per branch and this user has no branch assigned',
        'BRANCH_UNKNOWN',
      );
    }

    const products = await this.findAllMatching(query);
    const tracked = products.filter((product) => product.trackInventory);
    const links =
      tracked.length > 0
        ? await this.recipesService.findInventoryLinksByProducts(
            query.businessId,
            tracked.map((product) => product.id),
          )
        : new Map<string, ProductInventoryLink[]>();
    const stockByItem =
      links.size > 0
        ? await this.getStockByItem(query.businessId, stockBranchId)
        : new Map<string, number>();

    const branchMenu = await this.branchMenu(query, tracked);
    const ranked: { item: AssistantProduct; stock: number }[] = [];
    for (const product of tracked) {
      const inventory = this.describeInventory(
        product,
        links.get(product.id) ?? [],
        true,
        stockBranchId,
        stockByItem,
      );
      // Only a product with a figure can be placed: a recipe of several
      // ingredients, or no recipe at all, has no stock to compare.
      if (inventory.controlled && typeof inventory.currentStock === 'number') {
        ranked.push({
          item: this.toAssistantProduct(
            product,
            inventory,
            branchMenu.get(product.id),
          ),
          stock: inventory.currentStock,
        });
      }
    }

    const direction = query.sortOrder === 'desc' ? -1 : 1;
    ranked.sort(
      (a, b) =>
        (a.stock - b.stock) * direction ||
        a.item.name.localeCompare(b.item.name),
    );
    const items = ranked.slice(0, query.limit).map(({ item }) => item);
    return { items, count: items.length, total: ranked.length, stockBranchId };
  }

  /** Every product matching the filters, read a page at a time. */
  private async findAllMatching(
    query: AssistantProductsQuery,
  ): Promise<Product[]> {
    const products: Product[] = [];
    for (let page = 1; page <= RANKING_MAX_PAGES; page++) {
      const result = await this.productsService.findAll({
        businessId: query.businessId,
        page,
        limit: RANKING_PAGE_SIZE,
        search: query.search,
        isActive: query.isActive,
        isVisible: query.isVisible,
      });
      products.push(...result.data);
      if (
        result.data.length < RANKING_PAGE_SIZE ||
        products.length >= result.meta.total
      ) {
        break;
      }
    }
    return products;
  }

  private async listByName(
    query: AssistantProductsQuery,
  ): Promise<AssistantProductsResult> {
    const page = await this.productsService.findAll({
      businessId: query.businessId,
      page: 1,
      limit: query.limit,
      search: query.search,
      isActive: query.isActive,
      isVisible: query.isVisible,
    });
    const products = page.data;

    // One query for every product on the page, instead of a recipe lookup each.
    const trackedIds = products
      .filter((product) => product.trackInventory)
      .map((product) => product.id);
    const links =
      trackedIds.length > 0
        ? await this.recipesService.findInventoryLinksByProducts(
            query.businessId,
            trackedIds,
          )
        : new Map<string, ProductInventoryLink[]>();

    const needsStock = products.some((product) => {
      const productLinks = links.get(product.id);
      return (
        product.trackInventory &&
        productLinks?.length === 1 &&
        productLinks[0].inventoryItemAvailable
      );
    });

    let stockBranchId: string | null = null;
    let stockByItem = new Map<string, number>();
    if (needsStock && query.canReadStock) {
      stockBranchId = await this.resolveBranchId(query);
      if (stockBranchId) {
        stockByItem = await this.getStockByItem(
          query.businessId,
          stockBranchId,
        );
      }
    }

    const branchMenu = await this.branchMenu(query, products);
    const items = products.map((product) =>
      this.toAssistantProduct(
        product,
        this.describeInventory(
          product,
          links.get(product.id) ?? [],
          query.canReadStock,
          stockBranchId,
          stockByItem,
        ),
        branchMenu.get(product.id),
      ),
    );

    return {
      items,
      count: items.length,
      total: page.meta.total,
      stockBranchId,
    };
  }

  private toAssistantProduct(
    product: Product,
    inventory: AssistantProductInventory,
    atBranch?: BranchMenuEntry,
  ): AssistantProduct {
    return {
      id: product.id,
      name: product.name,
      description: product.description,
      sku: product.sku,
      categoryId: product.categoryId,
      salePrice: atBranch?.salePrice ?? product.salePrice,
      isActive: product.isActive,
      isVisible: product.isVisible,
      inventory,
      ...(atBranch && {
        atBranch: {
          offered: atBranch.isAvailable,
          soldOut: atBranch.outOfStock,
        },
      }),
    };
  }

  /**
   * Stock is kept per branch and is never added up across branches. The
   * caller's own branch is used; a caller without one is taken to be at the
   * business's only active branch, the same rule the login applies. With
   * several branches and none assigned there is no way to choose.
   */
  private async resolveBranchId(
    query: AssistantProductsQuery,
  ): Promise<string | null> {
    return (
      query.branchId ??
      (await this.branchesService.findOnlyActiveBranchId(query.businessId))
    );
  }

  /**
   * The branch's stock per item, from the one call that returns every level
   * of the branch. An item stored in several locations has a level in each;
   * they add up, as InventoryMovementsService.getStockForItem does.
   */
  private async getStockByItem(
    businessId: string,
    branchId: string,
  ): Promise<Map<string, number>> {
    const levels = await this.movementsService.getStock({
      businessId,
      branchId,
    });
    const stockByItem = new Map<string, number>();
    for (const level of levels) {
      stockByItem.set(
        level.inventoryItemId,
        (stockByItem.get(level.inventoryItemId) ?? 0) + level.stock,
      );
    }
    return stockByItem;
  }

  private describeInventory(
    product: Product,
    links: ProductInventoryLink[],
    canReadStock: boolean,
    stockBranchId: string | null,
    stockByItem: Map<string, number>,
  ): AssistantProductInventory {
    if (!product.trackInventory) {
      return { controlled: false };
    }
    if (links.length === 0) {
      return { controlled: true, mode: 'UNLINKED', currentStock: null };
    }
    if (links.length > 1) {
      return {
        controlled: true,
        mode: 'RECIPE',
        ingredientCount: links.length,
        currentStock: null,
      };
    }

    const [link] = links;
    if (!canReadStock) {
      // Which item backs the product is inventory information too.
      return this.directWithoutStock('NO_INVENTORY_ACCESS');
    }
    const item = {
      itemId: link.inventoryItemId,
      itemName: link.inventoryItemName,
      unit: link.unit,
      quantityPerUnit: link.quantityPerUnit,
    };
    if (!link.inventoryItemAvailable) {
      return this.directWithoutStock('INVENTORY_ITEM_UNAVAILABLE', item);
    }
    if (!stockBranchId) {
      return this.directWithoutStock('BRANCH_UNKNOWN', item);
    }
    return {
      controlled: true,
      mode: 'DIRECT',
      ...item,
      // An item with no movements in the branch has no level at all: its stock is zero.
      currentStock: roundQuantity(stockByItem.get(link.inventoryItemId) ?? 0),
    };
  }

  private directWithoutStock(
    reason: StockUnavailableReason,
    item: Partial<
      Pick<
        Extract<AssistantProductInventory, { mode: 'DIRECT' }>,
        'itemId' | 'itemName' | 'unit' | 'quantityPerUnit'
      >
    > = {},
  ): AssistantProductInventory {
    return {
      controlled: true,
      mode: 'DIRECT',
      ...item,
      currentStock: null,
      stockUnavailableReason: reason,
    };
  }
}

/**
 * How the catalog is read to rank it by stock: pages of this size, and no
 * more than this many of them. A menu is a few hundred products at most; the
 * ceiling only keeps a runaway catalog from being loaded whole.
 */
const RANKING_PAGE_SIZE = 100;
const RANKING_MAX_PAGES = 20;

/** Quantities are kept to three decimals; adding levels in floating point can leave a stray tail. */
function roundQuantity(value: number): number {
  return Math.round(value * 1000) / 1000;
}
