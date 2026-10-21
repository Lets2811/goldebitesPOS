import { ProductMenuAvailability } from '../../products/domain/product.types';
import { EntityNotFoundException } from '../../../common/exceptions';
import { PublicMenuService } from './public-menu.service';

describe('PublicMenuService', () => {
  let businessesService: { findById: jest.Mock };
  let productCategoriesService: { findAll: jest.Mock };
  let productsService: { findAll: jest.Mock };
  let optionGroupsService: { findAll: jest.Mock };
  let branchMenuService: { forBranch: jest.Mock };
  let branchesService: {
    isActiveBranch: jest.Mock;
    firstActiveBranchId: jest.Mock;
  };
  let ordersService: { getSalesSummary: jest.Mock; getTopProducts: jest.Mock };
  let service: PublicMenuService;

  const businessId = 'business-1';

  beforeEach(() => {
    businessesService = {
      findById: jest
        .fn()
        .mockResolvedValue({ id: businessId, name: 'Golden Bites' }),
    };
    productCategoriesService = {
      findAll: jest.fn().mockResolvedValue({
        data: [
          { id: 'cat-drinks', name: 'Bebidas', builderDisplayOrder: 2 },
          {
            id: 'cat-empty',
            name: 'Sin productos activos',
            builderDisplayOrder: 1,
          },
        ],
      }),
    };
    productsService = {
      findAll: jest.fn().mockResolvedValue({
        data: [
          {
            id: 'p1',
            name: 'Limonada',
            salePrice: 8000,
            description: 'Con hierbabuena',
            categoryId: 'cat-drinks',
            imageUrl: null,
            optionGroups: [],
            menuAvailability: ProductMenuAvailability.MENU,
          },
          {
            id: 'p2',
            name: 'Agua',
            salePrice: 3000,
            description: null,
            categoryId: 'cat-drinks',
            imageUrl: null,
            optionGroups: [],
            menuAvailability: ProductMenuAvailability.BOTH,
          },
          {
            id: 'p3',
            name: 'Combo especial',
            salePrice: 25000,
            description: 'Solo por hoy',
            categoryId: null,
            imageUrl: 'https://cdn.example.com/combo.jpg',
            optionGroups: [
              { groupId: 'g-salsas', maxChoices: 2 },
              { groupId: 'g-off', maxChoices: 1 },
              { groupId: 'g-empty', maxChoices: 1 },
            ],
            menuAvailability: ProductMenuAvailability.MENU,
          },
        ],
      }),
    };
    optionGroupsService = {
      findAll: jest.fn().mockResolvedValue([
        {
          id: 'g-salsas',
          name: 'Salsas',
          singularName: 'Salsa',
          isActive: true,
          isRequired: true,
          items: [
            { id: 's1', name: 'BBQ', isActive: true },
            { id: 's-old', name: 'Vieja', isActive: false },
            { id: 's2', name: 'Picante', isActive: true },
          ],
        },
        // Turned off by the business.
        {
          id: 'g-off',
          name: 'Hielo',
          singularName: 'Hielo',
          isActive: false,
          isRequired: false,
          items: [{ id: 'h1', name: 'Sin hielo', isActive: true }],
        },
        // Nothing active to pick.
        {
          id: 'g-empty',
          name: 'Tamaño',
          singularName: 'Tamaño',
          isActive: true,
          isRequired: false,
          items: [{ id: 't1', name: 'XL', isActive: false }],
        },
      ]),
    };
    branchMenuService = { forBranch: jest.fn().mockResolvedValue(new Map()) };
    ordersService = {
      getSalesSummary: jest
        .fn()
        .mockResolvedValue({ orderCount: 0, totalAmount: 0 }),
      getTopProducts: jest.fn().mockResolvedValue([]),
    };
    branchesService = {
      isActiveBranch: jest.fn().mockResolvedValue(true),
      firstActiveBranchId: jest.fn().mockResolvedValue('branch-1'),
    };
    service = new PublicMenuService(
      businessesService as never,
      productCategoriesService as never,
      productsService as never,
      optionGroupsService as never,
      branchMenuService as never,
      branchesService as never,
      ordersService as never,
    );
  });

  it('propagates EntityNotFoundException for an unknown business', async () => {
    businessesService.findById.mockRejectedValue(
      new EntityNotFoundException('Business', 'bogus'),
    );
    await expect(service.getMenu('bogus')).rejects.toThrow(
      EntityNotFoundException,
    );
  });

  it('only fetches products that are both active and visible — hidden surcharges never reach the public menu', async () => {
    await service.getMenu(businessId);
    expect(productsService.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ isActive: true, isVisible: true }),
    );
  });

  describe("a branch's menu", () => {
    it("shows the catalog of the table's branch", async () => {
      await service.getMenu(businessId, 'branch-2');
      expect(productsService.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ branchId: 'branch-2' }),
      );
      expect(branchMenuService.forBranch).toHaveBeenCalledWith(
        businessId,
        'branch-2',
      );
    });

    it("takes the business's first branch when none is given", async () => {
      await service.getMenu(businessId);
      expect(productsService.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ branchId: 'branch-1' }),
      );
    });

    it('leaves out what ran out', async () => {
      branchMenuService.forBranch.mockResolvedValue(
        new Map([
          ['p1', { salePrice: 8000, isAvailable: true, outOfStock: false }],
          ['p2', { salePrice: 3000, isAvailable: true, outOfStock: true }],
        ]),
      );

      const menu = await service.getMenu(businessId, 'branch-1');

      const drinks = menu.categories.find((c) => c.id === 'cat-drinks');
      expect(drinks?.products.map((p) => p.name)).toEqual(['Limonada']);
    });
  });

  it('groups active products by category, sorted by name within each category', async () => {
    const menu = await service.getMenu(businessId);

    expect(menu.businessName).toBe('Golden Bites');
    const drinks = menu.categories.find((c) => c.id === 'cat-drinks');
    expect(drinks?.products.map((p) => p.name)).toEqual(['Agua', 'Limonada']);
  });

  it('includes the image and the option groups each product offers, leaving out groups that are off or empty', async () => {
    const menu = await service.getMenu(businessId);
    const combo = menu.categories
      .flatMap((c) => c.products)
      .find((p) => p.id === 'p3');

    expect(combo).toEqual(
      expect.objectContaining({
        imageUrl: 'https://cdn.example.com/combo.jpg',
        optionGroups: [{ groupId: 'g-salsas', maxChoices: 2 }],
      }),
    );
  });

  it('returns the business-wide groups once, with only their active options', async () => {
    const menu = await service.getMenu(businessId);

    expect(menu.optionGroups).toEqual([
      {
        id: 'g-salsas',
        name: 'Salsas',
        singularName: 'Salsa',
        isRequired: true,
        items: [
          { id: 's1', name: 'BBQ' },
          { id: 's2', name: 'Picante' },
        ],
      },
    ]);
  });

  describe('"Arma tu combo"', () => {
    it('keeps builder-only products out of the regular menu and shows "both" products in each', async () => {
      productsService.findAll.mockResolvedValue({
        data: [
          {
            id: 'menu',
            name: 'Limonada',
            salePrice: 8000,
            description: null,
            categoryId: 'cat-drinks',
            imageUrl: null,
            optionGroups: [],
            menuAvailability: ProductMenuAvailability.MENU,
          },
          {
            id: 'both',
            name: 'Agua',
            salePrice: 3000,
            description: null,
            categoryId: 'cat-drinks',
            imageUrl: null,
            optionGroups: [],
            menuAvailability: ProductMenuAvailability.BOTH,
          },
          {
            id: 'builder',
            name: 'Tenders x3',
            salePrice: 15000,
            description: null,
            categoryId: null,
            imageUrl: null,
            optionGroups: [{ groupId: 'g-salsas', maxChoices: 1 }],
            menuAvailability: ProductMenuAvailability.BUILDER,
          },
        ],
      });

      const menu = await service.getMenu('business-1');

      const ids = (categories: typeof menu.categories) =>
        categories.flatMap((c) => c.products.map((p) => p.id)).sort();
      expect(ids(menu.categories)).toEqual(['both', 'menu']);
      expect(ids(menu.builderCategories)).toEqual(['both', 'builder']);
      // Uncategorized builder products still get the "Otros" bucket.
      expect(menu.builderCategories.map((c) => c.name)).toEqual([
        'Bebidas',
        'Otros',
      ]);
    });

    it('orders the builder sections by their own order, not the menu one', async () => {
      productCategoriesService.findAll.mockResolvedValue({
        data: [
          // The menu order (the list's own order): Bebidas, then Tenders.
          { id: 'cat-drinks', name: 'Bebidas', builderDisplayOrder: 2 },
          { id: 'cat-tenders', name: 'Tenders', builderDisplayOrder: 1 },
        ],
      });
      productsService.findAll.mockResolvedValue({
        data: [
          {
            id: 'drink',
            name: 'Agua',
            salePrice: 3000,
            description: null,
            categoryId: 'cat-drinks',
            imageUrl: null,
            optionGroups: [],
            menuAvailability: ProductMenuAvailability.BOTH,
          },
          {
            id: 'tender',
            name: 'Tenders x3',
            salePrice: 15000,
            description: null,
            categoryId: 'cat-tenders',
            imageUrl: null,
            optionGroups: [{ groupId: 'g-salsas', maxChoices: 1 }],
            menuAvailability: ProductMenuAvailability.BOTH,
          },
        ],
      });

      const menu = await service.getMenu('business-1');

      expect(menu.categories.map((c) => c.name)).toEqual([
        'Bebidas',
        'Tenders',
      ]);
      expect(menu.builderCategories.map((c) => c.name)).toEqual([
        'Tenders',
        'Bebidas',
      ]);
    });

    it('offers no builder when no product is marked for it', async () => {
      const menu = await service.getMenu('business-1');

      expect(
        menu.builderCategories.flatMap((c) => c.products.map((p) => p.id)),
      ).toEqual(['p2']);
    });
  });

  it('omits categories with no active products', async () => {
    const menu = await service.getMenu(businessId);
    expect(menu.categories.find((c) => c.id === 'cat-empty')).toBeUndefined();
  });

  it('groups uncategorized products under a synthetic "Otros" bucket', async () => {
    const menu = await service.getMenu(businessId);
    const otros = menu.categories.find((c) => c.id === null);
    expect(otros?.name).toBe('Otros');
    expect(otros?.products.map((p) => p.name)).toEqual(['Combo especial']);
  });

  describe('the name of "Arma tu combo"', () => {
    it('is "Arma tu combo" until the business names it', async () => {
      const menu = await service.getMenu(businessId);
      expect(menu.builderName).toBe('Arma tu combo');
      expect(menu.builderDescription).toBe(
        'Escoge lo que quieras, a tu gusto y a tu estilo.',
      );
    });

    it("is the business's own once it names it", async () => {
      businessesService.findById.mockResolvedValue({
        id: businessId,
        name: 'Golden Bites',
        comboBuilderName: 'Tu combo dorado',
        comboBuilderDescription: 'Mezcla lo que más te guste',
      });

      const menu = await service.getMenu(businessId);

      expect(menu.builderName).toBe('Tu combo dorado');
      expect(menu.builderDescription).toBe('Mezcla lo que más te guste');
    });
  });

  it('omits the "Otros" bucket entirely when every active product has a category', async () => {
    productsService.findAll.mockResolvedValue({
      data: [
        {
          id: 'p1',
          name: 'Limonada',
          salePrice: 8000,
          description: null,
          categoryId: 'cat-drinks',
          imageUrl: null,
          optionGroups: [],
        },
      ],
    });

    const menu = await service.getMenu(businessId);
    expect(menu.categories.some((c) => c.id === null)).toBe(false);
  });

  describe('"Lo más pedido"', () => {
    const top = (...ids: (string | null)[]) =>
      ids.map((productId) => ({
        productId,
        productName: '',
        quantitySold: 1,
        revenue: 0,
      }));

    function turnedOn() {
      businessesService.findById.mockResolvedValue({
        id: businessId,
        name: 'Golden Bites',
        timezone: 'America/Bogota',
        menuTopSellers: true,
      });
    }

    it('is left out, without counting anything, when the business turned it off', async () => {
      const menu = await service.getMenu(businessId);

      expect(menu.topSellers).toBeNull();
      expect(ordersService.getTopProducts).not.toHaveBeenCalled();
    });

    it("shows today's best sellers once the day has enough sales, only what can be ordered", async () => {
      turnedOn();
      ordersService.getSalesSummary.mockResolvedValue({
        orderCount: 12,
        totalAmount: 0,
      });
      // p9 is not on the menu (sold out, hidden or only for combos); a deleted product has no id.
      ordersService.getTopProducts
        .mockResolvedValueOnce(top('p3', 'p9', null, 'p1'))
        .mockResolvedValueOnce(top('p2'));

      const menu = await service.getMenu(businessId, 'branch-1');

      expect(menu.topSellers).toEqual({
        period: 'TODAY',
        productIds: ['p3', 'p1'],
      });
      expect(ordersService.getTopProducts).toHaveBeenCalledWith(
        businessId,
        'branch-1',
        expect.any(String),
        expect.any(String),
        expect.any(Number),
        'quantity',
      );
    });

    it("shows yesterday's while today has few sales", async () => {
      turnedOn();
      ordersService.getSalesSummary.mockResolvedValue({
        orderCount: 2,
        totalAmount: 0,
      });
      ordersService.getTopProducts
        .mockResolvedValueOnce(top('p3'))
        .mockResolvedValueOnce(top('p2', 'p1'));

      const menu = await service.getMenu(businessId, 'branch-1');

      expect(menu.topSellers).toEqual({
        period: 'RECENT',
        productIds: ['p2', 'p1'],
      });
    });

    it("shows today's few when yesterday sold nothing (a day the place was closed)", async () => {
      turnedOn();
      ordersService.getSalesSummary.mockResolvedValue({
        orderCount: 1,
        totalAmount: 0,
      });
      ordersService.getTopProducts
        .mockResolvedValueOnce(top('p1'))
        .mockResolvedValueOnce(top());

      const menu = await service.getMenu(businessId, 'branch-1');

      expect(menu.topSellers).toEqual({ period: 'TODAY', productIds: ['p1'] });
    });

    it('shows nothing when no orderable product sold', async () => {
      turnedOn();
      ordersService.getTopProducts.mockResolvedValue(top('p9'));

      const menu = await service.getMenu(businessId, 'branch-1');

      expect(menu.topSellers).toBeNull();
    });

    it('counts the sales once a minute, not on every opening', async () => {
      turnedOn();
      ordersService.getTopProducts.mockResolvedValue(top('p1'));

      await service.getMenu(businessId, 'branch-1');
      await service.getMenu(businessId, 'branch-1');

      expect(ordersService.getSalesSummary).toHaveBeenCalledTimes(1);
    });
  });
});
