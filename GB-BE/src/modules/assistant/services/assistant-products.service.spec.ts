import { ProductMenuAvailability } from '../../products/domain/product.types';
import {
  BusinessRuleException,
  UnauthorizedOperationException,
} from '../../../common/exceptions';
import { Product } from '../../products/domain/product.interface';
import { ProductInventoryLink } from '../../recipes/domain/recipe.interface';
import { AssistantProductsQuery } from '../domain/assistant-product.interface';
import { AssistantProductsService } from './assistant-products.service';

describe('AssistantProductsService', () => {
  let productsService: { findAll: jest.Mock };
  let recipesService: { findInventoryLinksByProducts: jest.Mock };
  let movementsService: { getStock: jest.Mock };
  let branchesService: { findOnlyActiveBranchId: jest.Mock };
  let service: AssistantProductsService;

  const businessId = 'business-1';
  const branchId = 'branch-1';

  function makeProduct(overrides: Partial<Product> = {}): Product {
    return {
      id: 'product-1',
      businessId,
      categoryId: null,
      name: 'Agua Manantial',
      description: null,
      sku: null,
      salePrice: 5000,
      currentCost: 2000,
      imageUrl: null,
      isActive: true,
      isVisible: true,
      trackInventory: true,
      optionGroups: [],
      menuAvailability: ProductMenuAvailability.MENU,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  function makeLink(
    overrides: Partial<ProductInventoryLink> = {},
  ): ProductInventoryLink {
    return {
      productId: 'product-1',
      inventoryItemId: 'item-water',
      inventoryItemName: 'Agua botella manantial',
      unit: 'botella',
      quantityPerUnit: 1,
      inventoryItemAvailable: true,
      ...overrides,
    };
  }

  function makeQuery(
    overrides: Partial<AssistantProductsQuery> = {},
  ): AssistantProductsQuery {
    return {
      businessId,
      branchId,
      canReadStock: true,
      limit: 10,
      sortBy: 'name',
      sortOrder: 'asc',
      ...overrides,
    };
  }

  function givenProducts(products: Product[], total = products.length) {
    productsService.findAll.mockResolvedValue({
      data: products,
      meta: { total },
    });
  }

  function givenLinks(links: ProductInventoryLink[]) {
    const byProduct = new Map<string, ProductInventoryLink[]>();
    for (const link of links) {
      byProduct.set(link.productId, [
        ...(byProduct.get(link.productId) ?? []),
        link,
      ]);
    }
    recipesService.findInventoryLinksByProducts.mockResolvedValue(byProduct);
  }

  function givenStock(levels: { inventoryItemId: string; stock: number }[]) {
    movementsService.getStock.mockResolvedValue(
      levels.map((level) => ({
        businessId,
        branchId,
        locationId: null,
        ...level,
      })),
    );
  }

  beforeEach(() => {
    productsService = { findAll: jest.fn() };
    recipesService = {
      findInventoryLinksByProducts: jest.fn().mockResolvedValue(new Map()),
    };
    movementsService = { getStock: jest.fn().mockResolvedValue([]) };
    branchesService = {
      findOnlyActiveBranchId: jest.fn().mockResolvedValue(null),
    };
    service = new AssistantProductsService(
      productsService as never,
      recipesService as never,
      movementsService as never,
      branchesService as never,
    );
    givenProducts([]);
  });

  describe('search', () => {
    it('searches through ProductsService, scoped to the business, first page only', async () => {
      await service.search(
        makeQuery({
          search: 'Agua Manantial',
          isActive: true,
          isVisible: false,
          limit: 5,
        }),
      );

      expect(productsService.findAll).toHaveBeenCalledWith({
        businessId,
        page: 1,
        limit: 5,
        search: 'Agua Manantial',
        isActive: true,
        isVisible: false,
      });
    });

    it('returns an existing product with its catalog fields', async () => {
      givenProducts([
        makeProduct({ trackInventory: false, sku: 'AG-1', description: 'x' }),
      ]);

      const result = await service.search(makeQuery());

      expect(result.count).toBe(1);
      expect(result.total).toBe(1);
      expect(result.items[0]).toEqual({
        id: 'product-1',
        name: 'Agua Manantial',
        description: 'x',
        sku: 'AG-1',
        categoryId: null,
        salePrice: 5000,
        isActive: true,
        isVisible: true,
        inventory: { controlled: false },
      });
    });

    it('returns every match, each with its own inventory, without picking one', async () => {
      givenProducts([
        makeProduct({ id: 'p-1', name: 'Agua Manantial' }),
        makeProduct({ id: 'p-2', name: 'Agua con gas' }),
        makeProduct({
          id: 'p-3',
          name: 'Agua saborizada',
          trackInventory: false,
        }),
      ]);
      givenLinks([
        makeLink({ productId: 'p-1', inventoryItemId: 'item-1' }),
        makeLink({ productId: 'p-2', inventoryItemId: 'item-2' }),
      ]);
      givenStock([
        { inventoryItemId: 'item-1', stock: 10 },
        { inventoryItemId: 'item-2', stock: 3 },
      ]);

      const result = await service.search(makeQuery({ search: 'agua' }));

      expect(result.items.map((item) => item.name)).toEqual([
        'Agua Manantial',
        'Agua con gas',
        'Agua saborizada',
      ]);
      expect(result.items[0].inventory).toMatchObject({ currentStock: 10 });
      expect(result.items[1].inventory).toMatchObject({ currentStock: 3 });
      expect(result.items[2].inventory).toEqual({ controlled: false });
    });

    it('returns an empty list, and looks nothing else up, when no product matches', async () => {
      const result = await service.search(makeQuery({ search: 'nada' }));

      expect(result).toEqual({
        items: [],
        count: 0,
        total: 0,
        stockBranchId: null,
      });
      expect(
        recipesService.findInventoryLinksByProducts,
      ).not.toHaveBeenCalled();
      expect(movementsService.getStock).not.toHaveBeenCalled();
    });

    it('reports how many match in total when the limit cuts the list', async () => {
      givenProducts([makeProduct({ trackInventory: false })], 37);

      const result = await service.search(makeQuery({ limit: 1 }));

      expect(result.count).toBe(1);
      expect(result.total).toBe(37);
    });
  });

  describe('inventory', () => {
    it('a product that does not track inventory has no stock at all — not zero', async () => {
      givenProducts([makeProduct({ trackInventory: false })]);

      const result = await service.search(makeQuery());

      expect(result.items[0].inventory).toEqual({ controlled: false });
      expect(result.items[0].inventory).not.toHaveProperty('currentStock');
      expect(
        recipesService.findInventoryLinksByProducts,
      ).not.toHaveBeenCalled();
      expect(movementsService.getStock).not.toHaveBeenCalled();
    });

    it('a product backed by one inventory item reports that item and its stock', async () => {
      givenProducts([makeProduct()]);
      givenLinks([makeLink()]);
      givenStock([{ inventoryItemId: 'item-water', stock: 10 }]);

      const result = await service.search(makeQuery());

      expect(result.items[0].inventory).toEqual({
        controlled: true,
        mode: 'DIRECT',
        itemId: 'item-water',
        itemName: 'Agua botella manantial',
        unit: 'botella',
        quantityPerUnit: 1,
        currentStock: 10,
      });
      expect(result.stockBranchId).toBe(branchId);
    });

    it('reports a real stock of zero as zero', async () => {
      givenProducts([makeProduct()]);
      givenLinks([makeLink()]);
      givenStock([{ inventoryItemId: 'item-water', stock: 0 }]);

      const result = await service.search(makeQuery());

      expect(result.items[0].inventory).toMatchObject({
        controlled: true,
        mode: 'DIRECT',
        currentStock: 0,
      });
    });

    it('an item with no movements in the branch has zero stock', async () => {
      givenProducts([makeProduct()]);
      givenLinks([makeLink()]);
      givenStock([]);

      const result = await service.search(makeQuery());

      expect(result.items[0].inventory).toMatchObject({ currentStock: 0 });
    });

    it('adds up the levels of an item stored in several locations of the branch', async () => {
      givenProducts([makeProduct()]);
      givenLinks([makeLink()]);
      givenStock([
        { inventoryItemId: 'item-water', stock: 6.1 },
        { inventoryItemId: 'item-water', stock: 3.2 },
        { inventoryItemId: 'another-item', stock: 99 },
      ]);

      const result = await service.search(makeQuery());

      expect(result.items[0].inventory).toMatchObject({ currentStock: 9.3 });
    });

    it('gives no stock, and says why, when the linked inventory item was deleted or deactivated', async () => {
      givenProducts([makeProduct()]);
      givenLinks([makeLink({ inventoryItemAvailable: false })]);

      const result = await service.search(makeQuery());

      expect(result.items[0].inventory).toEqual({
        controlled: true,
        mode: 'DIRECT',
        itemId: 'item-water',
        itemName: 'Agua botella manantial',
        unit: 'botella',
        quantityPerUnit: 1,
        currentStock: null,
        stockUnavailableReason: 'INVENTORY_ITEM_UNAVAILABLE',
      });
      expect(movementsService.getStock).not.toHaveBeenCalled();
    });

    it('a product with a multi-ingredient recipe is flagged as such, with no invented stock', async () => {
      givenProducts([makeProduct({ name: 'Nuggets x6' })]);
      givenLinks([
        makeLink({ inventoryItemId: 'item-chicken' }),
        makeLink({ inventoryItemId: 'item-oil' }),
      ]);

      const result = await service.search(makeQuery());

      expect(result.items[0].inventory).toEqual({
        controlled: true,
        mode: 'RECIPE',
        ingredientCount: 2,
        currentStock: null,
      });
      expect(movementsService.getStock).not.toHaveBeenCalled();
    });

    it('a product that tracks inventory but has no recipe is not linked to any stock', async () => {
      givenProducts([makeProduct()]);

      const result = await service.search(makeQuery());

      expect(result.items[0].inventory).toEqual({
        controlled: true,
        mode: 'UNLINKED',
        currentStock: null,
      });
    });
  });

  describe('lookups', () => {
    it('loads the links of the whole page in one call and the stock in one call', async () => {
      const products = Array.from({ length: 20 }, (_, i) =>
        makeProduct({ id: `p-${i}`, name: `Producto ${i}` }),
      );
      givenProducts(products);
      givenLinks(
        products.map((product) =>
          makeLink({
            productId: product.id,
            inventoryItemId: `i-${product.id}`,
          }),
        ),
      );

      await service.search(makeQuery({ limit: 20 }));

      expect(productsService.findAll).toHaveBeenCalledTimes(1);
      expect(recipesService.findInventoryLinksByProducts).toHaveBeenCalledTimes(
        1,
      );
      expect(recipesService.findInventoryLinksByProducts).toHaveBeenCalledWith(
        businessId,
        products.map((product) => product.id),
      );
      expect(movementsService.getStock).toHaveBeenCalledTimes(1);
    });

    it('only asks for the links of products that track inventory', async () => {
      givenProducts([
        makeProduct({ id: 'tracked' }),
        makeProduct({ id: 'untracked', trackInventory: false }),
      ]);

      await service.search(makeQuery());

      expect(recipesService.findInventoryLinksByProducts).toHaveBeenCalledWith(
        businessId,
        ['tracked'],
      );
    });
  });

  describe('branch', () => {
    it("reads the stock of the caller's branch only, never the whole business", async () => {
      givenProducts([makeProduct()]);
      givenLinks([makeLink()]);

      await service.search(makeQuery({ branchId: 'branch-7' }));

      expect(movementsService.getStock).toHaveBeenCalledWith({
        businessId,
        branchId: 'branch-7',
      });
      expect(branchesService.findOnlyActiveBranchId).not.toHaveBeenCalled();
    });

    it("uses the business's only active branch when the caller has none assigned", async () => {
      givenProducts([makeProduct()]);
      givenLinks([makeLink()]);
      givenStock([{ inventoryItemId: 'item-water', stock: 4 }]);
      branchesService.findOnlyActiveBranchId.mockResolvedValue('only-branch');

      const result = await service.search(makeQuery({ branchId: null }));

      expect(branchesService.findOnlyActiveBranchId).toHaveBeenCalledWith(
        businessId,
      );
      expect(movementsService.getStock).toHaveBeenCalledWith({
        businessId,
        branchId: 'only-branch',
      });
      expect(result.stockBranchId).toBe('only-branch');
      expect(result.items[0].inventory).toMatchObject({ currentStock: 4 });
    });

    it('gives no stock rather than adding up branches when the branch cannot be told', async () => {
      givenProducts([makeProduct()]);
      givenLinks([makeLink()]);

      const result = await service.search(makeQuery({ branchId: null }));

      expect(movementsService.getStock).not.toHaveBeenCalled();
      expect(result.stockBranchId).toBeNull();
      expect(result.items[0].inventory).toMatchObject({
        mode: 'DIRECT',
        itemId: 'item-water',
        currentStock: null,
        stockUnavailableReason: 'BRANCH_UNKNOWN',
      });
    });
  });

  describe('without access to inventory', () => {
    it('still returns the product, but neither the stock nor which item backs it', async () => {
      givenProducts([makeProduct()]);
      givenLinks([makeLink()]);

      const result = await service.search(makeQuery({ canReadStock: false }));

      expect(result.items[0].name).toBe('Agua Manantial');
      expect(result.items[0].inventory).toEqual({
        controlled: true,
        mode: 'DIRECT',
        currentStock: null,
        stockUnavailableReason: 'NO_INVENTORY_ACCESS',
      });
      expect(movementsService.getStock).not.toHaveBeenCalled();
      expect(branchesService.findOnlyActiveBranchId).not.toHaveBeenCalled();
    });
  });

  describe('ordered by stock', () => {
    /** Four products with a figure (5, 0, 12, 0), one with a recipe, one untracked, one unlinked. */
    function givenCatalog() {
      givenProducts([
        makeProduct({ id: 'p-water', name: 'Agua' }),
        makeProduct({ id: 'p-lulo', name: 'Hit Lulo' }),
        makeProduct({ id: 'p-cola', name: 'Cola' }),
        makeProduct({ id: 'p-premio', name: 'Premio' }),
        makeProduct({ id: 'p-nuggets', name: 'Nuggets' }),
        makeProduct({ id: 'p-combo', name: 'Combo', trackInventory: false }),
        makeProduct({ id: 'p-salsa', name: 'Salsa' }),
      ]);
      givenLinks([
        makeLink({ productId: 'p-water', inventoryItemId: 'i-water' }),
        makeLink({ productId: 'p-lulo', inventoryItemId: 'i-lulo' }),
        makeLink({ productId: 'p-cola', inventoryItemId: 'i-cola' }),
        makeLink({ productId: 'p-premio', inventoryItemId: 'i-premio' }),
        makeLink({ productId: 'p-nuggets', inventoryItemId: 'i-chicken' }),
        makeLink({ productId: 'p-nuggets', inventoryItemId: 'i-oil' }),
      ]);
      givenStock([
        { inventoryItemId: 'i-water', stock: 5 },
        { inventoryItemId: 'i-cola', stock: 12 },
        { inventoryItemId: 'i-premio', stock: 0 },
      ]);
    }

    const byStock = (overrides: Partial<AssistantProductsQuery> = {}) =>
      makeQuery({ sortBy: 'stock', ...overrides });

    it('lists the lowest stock first, with every tie at the bottom included', async () => {
      givenCatalog();

      const result = await service.search(byStock());

      expect(
        result.items.map((item) => [
          item.name,
          (item.inventory as { currentStock: number }).currentStock,
        ]),
      ).toEqual([
        ['Hit Lulo', 0],
        ['Premio', 0],
        ['Agua', 5],
        ['Cola', 12],
      ]);
    });

    it('lists the highest first when asked', async () => {
      givenCatalog();

      const result = await service.search(byStock({ sortOrder: 'desc' }));

      expect(result.items.map((item) => item.name)).toEqual([
        'Cola',
        'Agua',
        'Hit Lulo',
        'Premio',
      ]);
    });

    it('leaves out products with no stock figure, and counts only the ranked ones', async () => {
      givenCatalog();

      const result = await service.search(byStock());

      expect(result.items.map((item) => item.name)).not.toEqual(
        expect.arrayContaining(['Nuggets', 'Combo', 'Salsa']),
      );
      expect(result.count).toBe(4);
      expect(result.total).toBe(4);
      expect(result.stockBranchId).toBe(branchId);
    });

    it('applies the limit after ordering, not before', async () => {
      givenCatalog();

      const result = await service.search(byStock({ limit: 2 }));

      expect(result.items.map((item) => item.name)).toEqual([
        'Hit Lulo',
        'Premio',
      ]);
      expect(result.count).toBe(2);
      expect(result.total).toBe(4);
    });

    it('ranks the whole catalog, reading it in pages rather than only the first products', async () => {
      const firstPage = Array.from({ length: 100 }, (_, i) =>
        makeProduct({ id: `p-${i}`, name: `Producto ${i}` }),
      );
      const lowest = makeProduct({ id: 'p-last', name: 'Zumo' });
      productsService.findAll
        .mockResolvedValueOnce({ data: firstPage, meta: { total: 101 } })
        .mockResolvedValueOnce({ data: [lowest], meta: { total: 101 } });
      givenLinks(
        [...firstPage, lowest].map((product) =>
          makeLink({
            productId: product.id,
            inventoryItemId: `i-${product.id}`,
          }),
        ),
      );
      givenStock([
        ...firstPage.map((product) => ({
          inventoryItemId: `i-${product.id}`,
          stock: 50,
        })),
        { inventoryItemId: 'i-p-last', stock: 1 },
      ]);

      const result = await service.search(byStock({ limit: 1 }));

      expect(result.items[0].name).toBe('Zumo');
      expect(result.total).toBe(101);
      expect(productsService.findAll).toHaveBeenCalledTimes(2);
      expect(productsService.findAll).toHaveBeenLastCalledWith(
        expect.objectContaining({ businessId, page: 2, limit: 100 }),
      );
      // Still one lookup of links and one of stock, however many products.
      expect(recipesService.findInventoryLinksByProducts).toHaveBeenCalledTimes(
        1,
      );
      expect(movementsService.getStock).toHaveBeenCalledTimes(1);
    });

    it('keeps the search and the filters', async () => {
      givenCatalog();

      await service.search(
        byStock({ search: 'hit', isActive: true, isVisible: false }),
      );

      expect(productsService.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          businessId,
          search: 'hit',
          isActive: true,
          isVisible: false,
        }),
      );
    });

    it('returns nothing, without error, when no product has a stock figure', async () => {
      givenProducts([makeProduct({ trackInventory: false })]);

      const result = await service.search(byStock());

      expect(result).toEqual({
        items: [],
        count: 0,
        total: 0,
        stockBranchId: branchId,
      });
      expect(movementsService.getStock).not.toHaveBeenCalled();
    });

    it("uses the caller's branch, or the business's only one", async () => {
      givenCatalog();
      branchesService.findOnlyActiveBranchId.mockResolvedValue('only-branch');

      await service.search(byStock({ branchId: null }));

      expect(movementsService.getStock).toHaveBeenCalledWith({
        businessId,
        branchId: 'only-branch',
      });
    });

    it('refuses, rather than ranking across branches, when the branch cannot be told', async () => {
      givenCatalog();

      await expect(service.search(byStock({ branchId: null }))).rejects.toThrow(
        BusinessRuleException,
      );
      expect(productsService.findAll).not.toHaveBeenCalled();
      expect(movementsService.getStock).not.toHaveBeenCalled();
    });

    it('refuses a caller without access to inventory', async () => {
      givenCatalog();

      await expect(
        service.search(byStock({ canReadStock: false })),
      ).rejects.toThrow(UnauthorizedOperationException);
      expect(productsService.findAll).not.toHaveBeenCalled();
    });
  });
});
