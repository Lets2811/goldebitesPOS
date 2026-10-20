import { BranchCatalogService } from './branch-catalog.service';

describe('BranchCatalogService', () => {
  const businessId = 'business-1';
  const source = {
    id: 'p-1',
    branch_id: 'branch-1',
    name: 'Papas fritas',
    sku: 'PF-1',
    category_id: 'cat-1',
    description: null,
    sale_price: '8000.00',
    image_url: null,
    image_path: null,
    image_mime_type: null,
    track_inventory: true,
    is_visible: true,
    is_active: true,
  };

  let productsService: {
    getOwnedOrFail: jest.Mock;
    findAll: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    setVisible: jest.Mock;
    setActive: jest.Mock;
    setImage: jest.Mock;
  };
  let inventoryItemsService: {
    getOwnedOrFail: jest.Mock;
    findAll: jest.Mock;
    create: jest.Mock;
  };
  let recipesService: { findByProductOrNull: jest.Mock; create: jest.Mock };
  let branchesService: { isActiveBranch: jest.Mock };
  let service: BranchCatalogService;

  beforeEach(() => {
    productsService = {
      getOwnedOrFail: jest.fn().mockResolvedValue(source),
      findAll: jest.fn().mockResolvedValue({ data: [] }),
      findOne: jest.fn().mockResolvedValue({
        id: 'p-1',
        optionGroups: [{ groupId: 'g-1', maxChoices: 2 }],
        menuAvailability: 'MENU',
      }),
      create: jest.fn().mockResolvedValue({ id: 'p-2' }),
      setVisible: jest.fn(),
      setActive: jest.fn(),
      setImage: jest.fn(),
    };
    inventoryItemsService = {
      getOwnedOrFail: jest.fn((_b: string, id: string) =>
        Promise.resolve({
          id,
          name: id === 'i-papa' ? 'Papa' : 'Aceite',
          unit: id === 'i-papa' ? 'kg' : 'l',
          category_id: null,
          minimum_stock: '2.000',
          current_cost: '3000.00',
          brand: null,
          model: null,
        }),
      ),
      findAll: jest.fn((query: { search: string }) =>
        Promise.resolve({
          // The target branch already has "papa" (another casing), not "aceite".
          data:
            query.search === 'Papa'
              ? [{ id: 'i-papa-2', name: 'PAPA', unit: 'kg' }]
              : [],
        }),
      ),
      create: jest.fn().mockResolvedValue({ id: 'i-aceite-2' }),
    };
    recipesService = {
      findByProductOrNull: jest.fn().mockResolvedValue({
        name: 'Papas fritas',
        yieldQuantity: 1,
        instructions: null,
        items: [
          { inventoryItemId: 'i-papa', quantity: 0.3 },
          { inventoryItemId: 'i-aceite', quantity: 0.05 },
        ],
      }),
      create: jest.fn(),
    };
    branchesService = { isActiveBranch: jest.fn().mockResolvedValue(true) };
    service = new BranchCatalogService(
      productsService as never,
      inventoryItemsService as never,
      recipesService as never,
      branchesService as never,
    );
  });

  it('copies the product into the other branch, options included', async () => {
    await service.copyProductToBranch(businessId, 'p-1', 'branch-2', 'actor');

    expect(productsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        businessId,
        branchId: 'branch-2',
        name: 'Papas fritas',
        sku: 'PF-1',
        salePrice: 8000,
        optionGroups: [{ groupId: 'g-1', maxChoices: 2 }],
      }),
      'actor',
    );
  });

  it("builds the recipe from the other branch's items, creating the missing ones", async () => {
    await service.copyProductToBranch(businessId, 'p-1', 'branch-2', 'actor');

    expect(inventoryItemsService.create).toHaveBeenCalledTimes(1);
    expect(inventoryItemsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        branchId: 'branch-2',
        name: 'Aceite',
        unit: 'l',
      }),
      'actor',
    );
    expect(recipesService.create).toHaveBeenCalledWith(
      expect.objectContaining({ productId: 'p-2', yieldQuantity: 1 }),
      [
        { inventoryItemId: 'i-papa-2', quantity: 0.3 },
        { inventoryItemId: 'i-aceite-2', quantity: 0.05 },
      ],
      'actor',
    );
  });

  it('refuses the branch the product already is', async () => {
    await expect(
      service.copyProductToBranch(businessId, 'p-1', 'branch-1'),
    ).rejects.toMatchObject({ code: 'PRODUCT_ALREADY_IN_BRANCH' });
    expect(productsService.create).not.toHaveBeenCalled();
  });

  it('refuses when the other branch already has one with that name', async () => {
    productsService.findAll.mockResolvedValue({
      data: [{ name: 'papas fritas ', sku: null }],
    });

    await expect(
      service.copyProductToBranch(businessId, 'p-1', 'branch-2'),
    ).rejects.toMatchObject({ code: 'PRODUCT_ALREADY_IN_BRANCH' });
    expect(productsService.create).not.toHaveBeenCalled();
  });
});
