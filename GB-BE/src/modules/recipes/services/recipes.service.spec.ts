import {
  ConflictException,
  EntityNotFoundException,
} from '../../../common/exceptions';
import { RecipeItemDetailRow, RecipeRow } from '../domain/recipe.interface';
import { RecipesService } from './recipes.service';

describe('RecipesService', () => {
  let repository: {
    create: jest.Mock;
    findByProductId: jest.Mock;
    findById: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    findItemsWithDetails: jest.Mock;
    replaceItems: jest.Mock;
    getTotalCost: jest.Mock;
    findInventoryLinksByProductIds: jest.Mock;
  };
  let productsService: {
    getOwnedOrFail: jest.Mock;
    syncCostFromRecipe: jest.Mock;
  };
  let inventoryItemsService: { getOwnedOrFail: jest.Mock };
  let transactionService: { execute: jest.Mock };
  let auditService: { record: jest.Mock };
  let service: RecipesService;

  const businessId = 'business-1';
  const productId = 'product-1';

  function makeRecipeRow(overrides: Partial<RecipeRow> = {}): RecipeRow {
    return {
      id: 'recipe-1',
      business_id: businessId,
      product_id: productId,
      name: 'Classic Burger',
      yield_quantity: '1.000',
      instructions: null,
      created_at: new Date(),
      updated_at: new Date(),
      ...overrides,
    };
  }

  function makeItemRow(
    overrides: Partial<RecipeItemDetailRow> = {},
  ): RecipeItemDetailRow {
    return {
      id: 'ri-1',
      recipe_id: 'recipe-1',
      inventory_item_id: 'inv-1',
      quantity: '0.150',
      created_at: new Date(),
      inventory_item_name: 'Beef Patty',
      unit: 'kg',
      unit_cost: '18.50',
      ...overrides,
    };
  }

  beforeEach(() => {
    repository = {
      create: jest.fn(),
      findByProductId: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findItemsWithDetails: jest.fn().mockResolvedValue([]),
      replaceItems: jest.fn(),
      getTotalCost: jest.fn().mockResolvedValue(0),
      findInventoryLinksByProductIds: jest.fn().mockResolvedValue([]),
    };
    productsService = {
      getOwnedOrFail: jest
        .fn()
        .mockResolvedValue({ id: productId, name: 'Classic Burger' }),
      syncCostFromRecipe: jest.fn(),
    };
    inventoryItemsService = {
      getOwnedOrFail: jest.fn().mockResolvedValue({ id: 'inv-1' }),
    };
    transactionService = {
      execute: jest.fn((work: (client: unknown) => Promise<unknown>) =>
        work({}),
      ),
    };
    auditService = { record: jest.fn() };

    service = new RecipesService(
      repository,
      productsService as never,
      inventoryItemsService as never,
      transactionService as never,
      auditService as never,
    );
  });

  describe('create', () => {
    it('defaults the recipe name to the product name when omitted', async () => {
      repository.findByProductId.mockResolvedValue(null);
      repository.create.mockResolvedValue(makeRecipeRow());

      await service.create({ businessId, productId });

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Classic Burger' }),
        expect.anything(),
      );
    });

    it('rejects when the product already has a recipe', async () => {
      repository.findByProductId.mockResolvedValue(makeRecipeRow());

      await expect(service.create({ businessId, productId })).rejects.toThrow(
        ConflictException,
      );
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('rejects duplicate inventory items within the same items array', async () => {
      repository.findByProductId.mockResolvedValue(null);

      await expect(
        service.create({ businessId, productId }, [
          { inventoryItemId: 'inv-1', quantity: 1 },
          { inventoryItemId: 'inv-1', quantity: 2 },
        ]),
      ).rejects.toThrow(ConflictException);
    });

    it('validates every inventory item belongs to the business', async () => {
      repository.findByProductId.mockResolvedValue(null);
      repository.create.mockResolvedValue(makeRecipeRow());

      await service.create({ businessId, productId }, [
        { inventoryItemId: 'inv-1', quantity: 1 },
      ]);

      expect(inventoryItemsService.getOwnedOrFail).toHaveBeenCalledWith(
        businessId,
        'inv-1',
      );
    });

    it('syncs the product cost when items are provided at creation', async () => {
      repository.findByProductId.mockResolvedValue(null);
      repository.create.mockResolvedValue(makeRecipeRow());
      repository.getTotalCost.mockResolvedValue(2.78);

      await service.create({ businessId, productId }, [
        { inventoryItemId: 'inv-1', quantity: 0.15 },
      ]);

      expect(productsService.syncCostFromRecipe).toHaveBeenCalledWith(
        businessId,
        productId,
        2.78,
        {},
      );
    });
  });

  describe('findByProduct', () => {
    it('computes total cost and cost per portion from the recipe items', async () => {
      repository.findByProductId.mockResolvedValue(
        makeRecipeRow({ yield_quantity: '2.000' }),
      );
      repository.findItemsWithDetails.mockResolvedValue([makeItemRow()]);

      const recipe = await service.findByProduct(businessId, productId);

      expect(recipe.items).toHaveLength(1);
      expect(recipe.items[0].lineCost).toBeCloseTo(2.78, 2);
      expect(recipe.cost.totalCost).toBeCloseTo(2.78, 2);
      expect(recipe.cost.costPerPortion).toBeCloseTo(1.39, 2);
    });

    it('throws EntityNotFoundException when the product has no recipe', async () => {
      repository.findByProductId.mockResolvedValue(null);

      await expect(
        service.findByProduct(businessId, productId),
      ).rejects.toThrow(EntityNotFoundException);
    });
  });

  describe('setItems', () => {
    it('replaces items and re-syncs the product cost', async () => {
      repository.findByProductId.mockResolvedValue(makeRecipeRow());
      repository.getTotalCost.mockResolvedValue(5);

      await service.setItems(
        businessId,
        productId,
        [{ inventoryItemId: 'inv-1', quantity: 1 }],
        'actor-1',
      );

      expect(repository.replaceItems).toHaveBeenCalledWith(
        'recipe-1',
        [{ inventoryItemId: 'inv-1', quantity: 1 }],
        {},
      );
      expect(productsService.syncCostFromRecipe).toHaveBeenCalledWith(
        businessId,
        productId,
        5,
        {},
      );
    });
  });

  describe('remove', () => {
    it('deletes the recipe found for the product', async () => {
      repository.findByProductId.mockResolvedValue(makeRecipeRow());

      await service.remove(businessId, productId, 'actor-1');

      expect(repository.delete).toHaveBeenCalledWith('recipe-1', businessId);
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'DELETE' }),
      );
    });
  });
  describe('findInventoryLinksByProducts', () => {
    it('groups the links by product and derives the per-unit consumption from the yield', async () => {
      repository.findInventoryLinksByProductIds.mockResolvedValue([
        {
          product_id: 'water',
          inventory_item_id: 'inv-water',
          inventory_item_name: 'Agua botella',
          unit: 'botella',
          quantity: '1.000',
          yield_quantity: '1.000',
          inventory_item_available: true,
        },
        {
          product_id: 'burger',
          inventory_item_id: 'inv-beef',
          inventory_item_name: 'Beef',
          unit: 'kg',
          quantity: '0.600',
          yield_quantity: '4.000',
          inventory_item_available: true,
        },
        {
          product_id: 'burger',
          inventory_item_id: 'inv-bun',
          inventory_item_name: 'Bun',
          unit: 'unidad',
          quantity: '4.000',
          yield_quantity: '4.000',
          inventory_item_available: false,
        },
      ]);

      const links = await service.findInventoryLinksByProducts(businessId, [
        'water',
        'burger',
        'no-recipe',
      ]);

      expect(repository.findInventoryLinksByProductIds).toHaveBeenCalledWith(
        businessId,
        ['water', 'burger', 'no-recipe'],
      );
      expect(links.get('water')).toEqual([
        expect.objectContaining({
          inventoryItemId: 'inv-water',
          quantityPerUnit: 1,
          inventoryItemAvailable: true,
        }),
      ]);
      expect(links.get('burger')).toHaveLength(2);
      expect(links.get('burger')?.[0].quantityPerUnit).toBeCloseTo(0.15, 5);
      expect(links.get('burger')?.[1].inventoryItemAvailable).toBe(false);
      expect(links.has('no-recipe')).toBe(false);
    });
  });
});
