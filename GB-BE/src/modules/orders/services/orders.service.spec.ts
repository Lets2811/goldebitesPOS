import {
  BusinessRuleException,
  InvalidOrderStatusTransitionException,
} from '../../../common/exceptions';
import { InventoryMovementType } from '../../inventory-movements/domain/inventory-movement.types';
import {
  OrderItemRow,
  OrderRow,
  OrderStatus,
  OrderType,
} from '../domain/order.interface';
import { OrdersService } from './orders.service';

describe('OrdersService', () => {
  let repository: {
    create: jest.Mock;
    findById: jest.Mock;
    findAll: jest.Mock;
    findActiveForKitchen: jest.Mock;
    findActiveByTable: jest.Mock;
    findBacklog: jest.Mock;
    addItems: jest.Mock;
    replaceItems: jest.Mock;
    findItems: jest.Mock;
    updateTotals: jest.Mock;
    setDiscount: jest.Mock;
    setStatus: jest.Mock;
    updatePaymentStatus: jest.Mock;
    getTotalPaid: jest.Mock;
    addStatusHistory: jest.Mock;
    findStatusHistory: jest.Mock;
    getActiveCount: jest.Mock;
    getSalesSummary: jest.Mock;
    getSalesByDay: jest.Mock;
    getTopProducts: jest.Mock;
  };
  let branchesService: { findOne: jest.Mock };
  let productsService: { getOwnedOrFail: jest.Mock };
  let recipesService: { findByProductOrNull: jest.Mock };
  let customersService: {
    getOwnedOrFail: jest.Mock;
    recordCompletedOrder: jest.Mock;
  };
  let movementsService: {
    recordMovement: jest.Mock;
    getMovementsByReference: jest.Mock;
  };
  let businessesService: {
    getTaxRate: jest.Mock;
    getTimezone: jest.Mock;
    getDiscountsAtCheckout: jest.Mock;
  };
  let loyaltyService: { awardPointsForOrder: jest.Mock };
  let optionGroupsService: { findAll: jest.Mock; getProductGroups: jest.Mock };
  let transactionService: { execute: jest.Mock };
  let auditService: { record: jest.Mock };
  let discountsService: {
    resolve: jest.Mock;
    takeUse: jest.Mock;
    releaseUse: jest.Mock;
  };
  let service: OrdersService;

  const businessId = 'business-1';
  const branchId = 'branch-1';
  const productId = 'product-1';

  function makeOrderRow(overrides: Partial<OrderRow> = {}): OrderRow {
    return {
      id: 'order-1',
      business_id: businessId,
      branch_id: branchId,
      customer_id: null,
      customer_name: null,
      created_by: null,
      order_number: '1',
      order_type: OrderType.DINE_IN,
      status: OrderStatus.PENDING,
      payment_status: 'PENDING' as never,
      payment_policy: 'PAY_AT_END' as never,
      table_number: null,
      delivery_address: null,
      delivery_instructions: null,
      subtotal: '10000.00',
      discount_amount: '0.00',
      tax_amount: '0.00',
      delivery_fee: '0.00',
      total_amount: '10000.00',
      notes: null,
      confirmed_at: null,
      prepared_at: null,
      delivered_at: null,
      cancelled_at: null,
      created_at: new Date(),
      updated_at: new Date(),
      ...overrides,
    };
  }

  function makeItemRow(overrides: Partial<OrderItemRow> = {}): OrderItemRow {
    return {
      id: 'item-1',
      order_id: 'order-1',
      product_id: productId,
      product_name_snapshot: 'Burger',
      product_description_snapshot: null,
      quantity: '2.000',
      unit_price: '5000.00',
      unit_cost_snapshot: '2000.00',
      discount_amount: '0.00',
      total_price: '10000.00',
      notes: null,
      option_selections: [],
      created_at: new Date(),
      ...overrides,
    };
  }

  beforeEach(() => {
    repository = {
      create: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn().mockResolvedValue({ rows: [], total: 0 }),
      findActiveForKitchen: jest.fn().mockResolvedValue([]),
      findActiveByTable: jest.fn().mockResolvedValue(null),
      findBacklog: jest.fn().mockResolvedValue([]),
      addItems: jest.fn(),
      replaceItems: jest.fn(),
      findItems: jest.fn().mockResolvedValue([]),
      updateTotals: jest.fn(),
      setDiscount: jest.fn(),
      setStatus: jest.fn(),
      updatePaymentStatus: jest.fn(),
      getTotalPaid: jest.fn().mockResolvedValue(0),
      addStatusHistory: jest.fn(),
      findStatusHistory: jest.fn().mockResolvedValue([]),
      getActiveCount: jest.fn().mockResolvedValue(0),
      getSalesSummary: jest
        .fn()
        .mockResolvedValue({ order_count: '0', total_amount: null }),
      getSalesByDay: jest.fn().mockResolvedValue([]),
      getTopProducts: jest.fn().mockResolvedValue([]),
    };
    branchesService = {
      findOne: jest
        .fn()
        .mockResolvedValue({ id: branchId, paymentPolicy: 'PAY_AT_END' }),
    };
    productsService = {
      getOwnedOrFail: jest.fn().mockResolvedValue({
        id: productId,
        name: 'Burger',
        sale_price: '5000.00',
        current_cost: '2000.00',
        is_active: true,
        track_inventory: false,
      }),
    };
    recipesService = { findByProductOrNull: jest.fn().mockResolvedValue(null) };
    customersService = {
      getOwnedOrFail: jest.fn().mockResolvedValue({ id: 'customer-1' }),
      recordCompletedOrder: jest.fn(),
    };
    movementsService = {
      recordMovement: jest.fn().mockResolvedValue({}),
      getMovementsByReference: jest.fn().mockResolvedValue([]),
    };
    businessesService = {
      getTaxRate: jest.fn().mockResolvedValue(0),
      getTimezone: jest.fn().mockResolvedValue('America/Bogota'),
      getDiscountsAtCheckout: jest.fn().mockResolvedValue(true),
    };
    loyaltyService = { awardPointsForOrder: jest.fn() };
    optionGroupsService = {
      findAll: jest.fn().mockResolvedValue([]),
      getProductGroups: jest.fn().mockResolvedValue(new Map()),
    };
    transactionService = {
      execute: jest.fn((work: (client: unknown) => Promise<unknown>) =>
        work({}),
      ),
    };
    auditService = { record: jest.fn() };
    discountsService = {
      resolve: jest.fn(),
      takeUse: jest.fn().mockResolvedValue(true),
      releaseUse: jest.fn().mockResolvedValue(undefined),
    };

    service = new OrdersService(
      repository,
      branchesService as never,
      productsService as never,
      recipesService as never,
      customersService as never,
      movementsService as never,
      businessesService as never,
      loyaltyService as never,
      optionGroupsService as never,
      transactionService as never,
      auditService as never,
      discountsService as never,
    );
  });

  describe('create', () => {
    it('rejects an empty item list', async () => {
      await expect(
        service.create(
          { businessId, branchId, orderType: OrderType.DINE_IN },
          [],
        ),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('rejects an item whose product has been deactivated since the menu was loaded', async () => {
      productsService.getOwnedOrFail.mockResolvedValue({
        id: productId,
        name: 'Burger',
        sale_price: '5000.00',
        current_cost: '2000.00',
        is_active: false,
        track_inventory: false,
      });

      await expect(
        service.create({ businessId, branchId, orderType: OrderType.DINE_IN }, [
          { productId, quantity: 1 },
        ]),
      ).rejects.toThrow(BusinessRuleException);
      expect(repository.create).not.toHaveBeenCalled();
    });

    describe('option groups', () => {
      const salsas = {
        id: 'g-salsas',
        name: 'Salsas',
        singularName: 'Salsa',
        isActive: true,
        isRequired: false,
        defaultMax: 1,
        displayOrder: 0,
        items: [
          { id: 'bbq', groupId: 'g-salsas', name: 'BBQ', isActive: true },
          { id: 'ajo', groupId: 'g-salsas', name: 'Ajo', isActive: true },
        ],
      };
      const order = (item: Record<string, unknown> = {}): Promise<unknown> =>
        service.create({ businessId, branchId, orderType: OrderType.DINE_IN }, [
          { productId, quantity: 1, ...item },
        ]);

      beforeEach(() => {
        repository.create.mockResolvedValue(makeOrderRow());
        optionGroupsService.findAll.mockResolvedValue([salsas]);
        optionGroupsService.getProductGroups.mockResolvedValue(
          new Map([[productId, [{ groupId: 'g-salsas', maxChoices: 2 }]]]),
        );
      });

      it('loads the catalog once per order and stores the picks grouped, with their names', async () => {
        await service.create(
          { businessId, branchId, orderType: OrderType.DINE_IN },
          [
            { productId, quantity: 1, optionItemIds: ['bbq', 'ajo'] },
            { productId, quantity: 1 },
          ],
        );

        expect(optionGroupsService.findAll).toHaveBeenCalledTimes(1);
        const [, items] = repository.addItems.mock.calls[0] as [
          string,
          { optionSelections: unknown[] }[],
        ];
        expect(items[0].optionSelections).toEqual([
          {
            groupId: 'g-salsas',
            groupName: 'Salsas',
            itemIds: ['bbq', 'ajo'],
            itemNames: ['BBQ', 'Ajo'],
          },
        ]);
        expect(items[1].optionSelections).toEqual([]);
      });

      it('still reads the sauceIds older clients send, since migrated options kept their ids', async () => {
        await order({ sauceIds: ['bbq'] });

        const [, items] = repository.addItems.mock.calls[0] as [
          string,
          { optionSelections: { itemNames: string[] }[] }[],
        ];
        expect(items[0].optionSelections[0].itemNames).toEqual(['BBQ']);
      });

      it('rejects more picks than the product allows', async () => {
        optionGroupsService.getProductGroups.mockResolvedValue(
          new Map([[productId, [{ groupId: 'g-salsas', maxChoices: 1 }]]]),
        );

        await expect(
          order({ optionItemIds: ['bbq', 'ajo'] }),
        ).rejects.toMatchObject({ code: 'ORDER_ITEM_TOO_MANY_OPTIONS' });
        expect(repository.create).not.toHaveBeenCalled();
      });
    });

    it('computes subtotal/total from unit price * quantity with a 0 tax rate', async () => {
      repository.create.mockResolvedValue(makeOrderRow());

      await service.create(
        { businessId, branchId, orderType: OrderType.DINE_IN },
        [{ productId, quantity: 2 }],
      );

      expect(repository.updateTotals).toHaveBeenCalledWith(
        'order-1',
        10000,
        0,
        0,
        0,
        10000,
        expect.anything(),
      );
    });

    it("copies the branch's current payment policy onto the order at creation time", async () => {
      repository.create.mockResolvedValue(makeOrderRow());
      branchesService.findOne.mockResolvedValue({
        id: branchId,
        paymentPolicy: 'PREPAY_REQUIRED',
      });

      await service.create(
        { businessId, branchId, orderType: OrderType.DINE_IN },
        [{ productId, quantity: 1 }],
      );

      expect(repository.create).toHaveBeenCalledWith(
        expect.anything(),
        undefined,
        expect.anything(),
        'PREPAY_REQUIRED',
        expect.anything(),
      );
    });

    it('applies the business tax rate from Settings (regression: used to be hard-coded to 0)', async () => {
      businessesService.getTaxRate.mockResolvedValue(0.19);
      repository.create.mockResolvedValue(makeOrderRow());

      await service.create(
        { businessId, branchId, orderType: OrderType.DINE_IN },
        [{ productId, quantity: 2 }],
      );

      expect(businessesService.getTaxRate).toHaveBeenCalledWith(businessId);
      expect(repository.updateTotals).toHaveBeenCalledWith(
        'order-1',
        10000,
        0,
        1900,
        0,
        11900,
        expect.anything(),
      );
    });

    it('rejects a per-item discount that exceeds the line total', async () => {
      await expect(
        service.create({ businessId, branchId, orderType: OrderType.DINE_IN }, [
          { productId, quantity: 1, discountAmount: 999999 },
        ]),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('validates the customer belongs to the business when provided', async () => {
      repository.create.mockResolvedValue(
        makeOrderRow({ customer_id: 'customer-1' }),
      );

      await service.create(
        {
          businessId,
          branchId,
          orderType: OrderType.DINE_IN,
          customerId: 'customer-1',
        },
        [{ productId, quantity: 1 }],
      );

      expect(customersService.getOwnedOrFail).toHaveBeenCalledWith(
        businessId,
        'customer-1',
      );
    });
  });

  describe('replaceItems', () => {
    it('rejects editing items on a delivered order', async () => {
      repository.findById.mockResolvedValue(
        makeOrderRow({ status: OrderStatus.DELIVERED }),
      );

      await expect(
        service.replaceItems(businessId, 'order-1', [
          { productId, quantity: 1 },
        ]),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('rejects editing items on a cancelled order', async () => {
      repository.findById.mockResolvedValue(
        makeOrderRow({ status: OrderStatus.CANCELLED }),
      );

      await expect(
        service.replaceItems(businessId, 'order-1', [
          { productId, quantity: 1 },
        ]),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('allows editing a CONFIRMED order and does not touch stock when there was nothing consumed', async () => {
      repository.findById.mockResolvedValue(
        makeOrderRow({ status: OrderStatus.CONFIRMED }),
      );

      await expect(
        service.replaceItems(businessId, 'order-1', [
          { productId, quantity: 1 },
        ]),
      ).resolves.toBeDefined();
    });

    it('does not touch stock when editing a still-PENDING order', async () => {
      repository.findById.mockResolvedValue(
        makeOrderRow({ status: OrderStatus.PENDING }),
      );

      await service.replaceItems(businessId, 'order-1', [
        { productId, quantity: 1 },
      ]);

      expect(movementsService.getMovementsByReference).not.toHaveBeenCalled();
      expect(movementsService.recordMovement).not.toHaveBeenCalled();
    });

    it('reverses the net-outstanding stock and re-consumes for the new items when editing a CONFIRMED order', async () => {
      repository.findById.mockResolvedValue(
        makeOrderRow({ status: OrderStatus.CONFIRMED }),
      );
      productsService.getOwnedOrFail.mockResolvedValue({
        id: productId,
        name: 'Burger',
        sale_price: '5000.00',
        current_cost: '2000.00',
        is_active: true,
        track_inventory: true,
      });
      recipesService.findByProductOrNull.mockResolvedValue({
        items: [{ inventoryItemId: 'flour-1', quantity: 0.2 }],
        cost: { yieldQuantity: 1 },
      });
      movementsService.getMovementsByReference.mockResolvedValue([
        {
          movementType: InventoryMovementType.SALE_CONSUMPTION,
          inventoryItemId: 'flour-1',
          quantity: 0.2,
        },
      ]);

      await service.replaceItems(businessId, 'order-1', [
        { productId, quantity: 2 },
      ]);

      expect(movementsService.recordMovement).toHaveBeenCalledWith(
        expect.objectContaining({
          movementType: InventoryMovementType.RETURN,
          inventoryItemId: 'flour-1',
          quantity: 0.2,
          referenceType: 'order',
        }),
        expect.anything(),
      );
      expect(movementsService.recordMovement).toHaveBeenCalledWith(
        expect.objectContaining({
          movementType: InventoryMovementType.SALE_CONSUMPTION,
          inventoryItemId: 'flour-1',
          quantity: 0.4,
          referenceType: 'order',
        }),
        expect.anything(),
      );
    });
  });

  describe('addItems', () => {
    it('rejects an empty item list', async () => {
      await expect(service.addItems(businessId, 'order-1', [])).rejects.toThrow(
        BusinessRuleException,
      );
    });

    it('rejects adding items to a delivered order', async () => {
      repository.findById.mockResolvedValue(
        makeOrderRow({ status: OrderStatus.DELIVERED }),
      );

      await expect(
        service.addItems(businessId, 'order-1', [{ productId, quantity: 1 }]),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('rejects adding items to a cancelled order', async () => {
      repository.findById.mockResolvedValue(
        makeOrderRow({ status: OrderStatus.CANCELLED }),
      );

      await expect(
        service.addItems(businessId, 'order-1', [{ productId, quantity: 1 }]),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('rejects adding items to a PREPAY_REQUIRED order that already has a pending balance', async () => {
      repository.findById.mockResolvedValue(
        makeOrderRow({
          status: OrderStatus.CONFIRMED,
          payment_policy: 'PREPAY_REQUIRED' as never,
          total_amount: '10000.00',
        }),
      );
      repository.getTotalPaid.mockResolvedValue(0);

      await expect(
        service.addItems(businessId, 'order-1', [{ productId, quantity: 1 }]),
      ).rejects.toThrow(BusinessRuleException);
      expect(repository.addItems).not.toHaveBeenCalled();
    });

    it('allows adding items to a PREPAY_REQUIRED order once its current balance is fully paid', async () => {
      repository.findById.mockResolvedValue(
        makeOrderRow({
          status: OrderStatus.CONFIRMED,
          payment_policy: 'PREPAY_REQUIRED' as never,
          total_amount: '10000.00',
        }),
      );
      repository.getTotalPaid.mockResolvedValue(10000);

      await service.addItems(businessId, 'order-1', [
        { productId, quantity: 1 },
      ]);

      expect(repository.addItems).toHaveBeenCalled();
    });

    it('does not gate a PREPAY_REQUIRED order that is still PENDING (never sent to kitchen yet)', async () => {
      repository.findById.mockResolvedValue(
        makeOrderRow({
          status: OrderStatus.PENDING,
          payment_policy: 'PREPAY_REQUIRED' as never,
          total_amount: '10000.00',
        }),
      );
      repository.getTotalPaid.mockResolvedValue(0);

      await expect(
        service.addItems(businessId, 'order-1', [{ productId, quantity: 1 }]),
      ).resolves.toBeDefined();
      expect(repository.addItems).toHaveBeenCalled();
    });

    it('adds the new items on top of the existing subtotal without touching current items', async () => {
      repository.findById.mockResolvedValue(
        makeOrderRow({
          status: OrderStatus.CONFIRMED,
          subtotal: '10000.00',
          discount_amount: '0.00',
          delivery_fee: '0.00',
        }),
      );

      await service.addItems(businessId, 'order-1', [
        { productId, quantity: 1 },
      ]);

      expect(repository.addItems).toHaveBeenCalledWith(
        'order-1',
        expect.any(Array),
        expect.anything(),
      );
      expect(repository.updateTotals).toHaveBeenCalledWith(
        'order-1',
        15000,
        0,
        0,
        0,
        15000,
        expect.anything(),
      );
    });

    it('does not consume stock when the order is still PENDING (it will be consumed at CONFIRMED)', async () => {
      repository.findById.mockResolvedValue(
        makeOrderRow({ status: OrderStatus.PENDING }),
      );

      await service.addItems(businessId, 'order-1', [
        { productId, quantity: 1 },
      ]);

      expect(movementsService.recordMovement).not.toHaveBeenCalled();
    });

    it('consumes stock immediately for items added after the order was already confirmed', async () => {
      repository.findById.mockResolvedValue(
        makeOrderRow({ status: OrderStatus.CONFIRMED }),
      );
      productsService.getOwnedOrFail.mockResolvedValue({
        id: productId,
        name: 'Burger',
        sale_price: '5000.00',
        current_cost: '2000.00',
        is_active: true,
        track_inventory: true,
      });
      recipesService.findByProductOrNull.mockResolvedValue({
        items: [{ inventoryItemId: 'flour-1', quantity: 0.2 }],
        cost: { yieldQuantity: 1 },
      });

      await service.addItems(businessId, 'order-1', [
        { productId, quantity: 2 },
      ]);

      expect(movementsService.recordMovement).toHaveBeenCalledWith(
        expect.objectContaining({
          movementType: InventoryMovementType.SALE_CONSUMPTION,
          inventoryItemId: 'flour-1',
          quantity: 0.4,
          referenceType: 'order',
          referenceId: 'order-1',
        }),
        expect.anything(),
      );
    });

    it("re-evaluates payment_status against the new total — the ticket's own AC example ($30k paid, $20k added, PAID -> PARTIALLY_PAID)", async () => {
      repository.findById.mockResolvedValue(
        makeOrderRow({
          status: OrderStatus.CONFIRMED,
          payment_status: 'PAID' as never,
          subtotal: '30000.00',
          discount_amount: '0.00',
          delivery_fee: '0.00',
          total_amount: '30000.00',
        }),
      );
      repository.getTotalPaid.mockResolvedValue(30000);

      const result = await service.addItems(businessId, 'order-1', [
        { productId, quantity: 4 }, // 4 * 5000 = 20000
      ]);

      expect(repository.updateTotals).toHaveBeenCalledWith(
        'order-1',
        50000,
        0,
        0,
        0,
        50000,
        expect.anything(),
      );
      expect(repository.updatePaymentStatus).toHaveBeenCalledWith(
        'order-1',
        'PARTIALLY_PAID',
        expect.anything(),
      );
      expect(result.paymentStatus).toBe('PARTIALLY_PAID');
      // The payment itself is never touched — only read and re-compared against the new total.
      expect(repository.getTotalPaid).toHaveBeenCalledWith(
        'order-1',
        expect.anything(),
      );
    });

    it('leaves payment_status PENDING when the order still has no payments at all', async () => {
      repository.findById.mockResolvedValue(
        makeOrderRow({
          status: OrderStatus.CONFIRMED,
          payment_status: 'PENDING' as never,
        }),
      );
      repository.getTotalPaid.mockResolvedValue(0);

      const result = await service.addItems(businessId, 'order-1', [
        { productId, quantity: 1 },
      ]);

      expect(repository.updatePaymentStatus).toHaveBeenCalledWith(
        'order-1',
        'PENDING',
        expect.anything(),
      );
      expect(result.paymentStatus).toBe('PENDING');
    });

    it('stays PAID when the amount already paid still covers the new, larger total', async () => {
      repository.findById.mockResolvedValue(
        makeOrderRow({
          status: OrderStatus.CONFIRMED,
          payment_status: 'PAID' as never,
        }),
      );
      repository.getTotalPaid.mockResolvedValue(60000); // overpaid relative to the new 15000 total

      const result = await service.addItems(businessId, 'order-1', [
        { productId, quantity: 1 },
      ]);

      expect(repository.updatePaymentStatus).toHaveBeenCalledWith(
        'order-1',
        'PAID',
        expect.anything(),
      );
      expect(result.paymentStatus).toBe('PAID');
    });
  });

  describe('updateStatus', () => {
    it('rejects an invalid transition', async () => {
      repository.findById.mockResolvedValue(
        makeOrderRow({ status: OrderStatus.DELIVERED }),
      );

      await expect(
        service.updateStatus(businessId, 'order-1', OrderStatus.CONFIRMED),
      ).rejects.toThrow(InvalidOrderStatusTransitionException);
    });

    it("rejects confirming a PREPAY_REQUIRED order that is not fully paid — the ticket's own AC", async () => {
      repository.findById.mockResolvedValue(
        makeOrderRow({
          status: OrderStatus.PENDING,
          payment_policy: 'PREPAY_REQUIRED' as never,
          total_amount: '10000.00',
        }),
      );
      repository.getTotalPaid.mockResolvedValue(0);

      await expect(
        service.updateStatus(businessId, 'order-1', OrderStatus.CONFIRMED),
      ).rejects.toThrow(BusinessRuleException);
      expect(repository.setStatus).not.toHaveBeenCalled();
    });

    it('allows confirming a PREPAY_REQUIRED order once it is fully paid', async () => {
      repository.findById.mockResolvedValue(
        makeOrderRow({
          status: OrderStatus.PENDING,
          payment_policy: 'PREPAY_REQUIRED' as never,
          total_amount: '10000.00',
        }),
      );
      repository.getTotalPaid.mockResolvedValue(10000);
      repository.setStatus.mockResolvedValue(
        makeOrderRow({ status: OrderStatus.CONFIRMED }),
      );

      await service.updateStatus(businessId, 'order-1', OrderStatus.CONFIRMED);

      expect(repository.setStatus).toHaveBeenCalled();
    });

    it('never gates a PAY_AT_END order regardless of how much is paid', async () => {
      repository.findById.mockResolvedValue(
        makeOrderRow({
          status: OrderStatus.PENDING,
          payment_policy: 'PAY_AT_END' as never,
        }),
      );
      repository.getTotalPaid.mockResolvedValue(0);
      repository.setStatus.mockResolvedValue(
        makeOrderRow({ status: OrderStatus.CONFIRMED }),
      );

      await service.updateStatus(businessId, 'order-1', OrderStatus.CONFIRMED);

      expect(repository.setStatus).toHaveBeenCalled();
    });

    it('consumes stock per recipe item when confirming an order for a tracked product', async () => {
      repository.findById.mockResolvedValue(makeOrderRow());
      repository.findItems.mockResolvedValue([makeItemRow()]);
      repository.setStatus.mockResolvedValue(
        makeOrderRow({ status: OrderStatus.CONFIRMED }),
      );
      productsService.getOwnedOrFail.mockResolvedValue({
        id: productId,
        name: 'Burger',
        track_inventory: true,
      });
      recipesService.findByProductOrNull.mockResolvedValue({
        items: [{ inventoryItemId: 'flour-1', quantity: 0.2 }],
        cost: { yieldQuantity: 1 },
      });

      await service.updateStatus(
        businessId,
        'order-1',
        OrderStatus.CONFIRMED,
        'actor-1',
      );

      expect(movementsService.recordMovement).toHaveBeenCalledWith(
        expect.objectContaining({
          movementType: InventoryMovementType.SALE_CONSUMPTION,
          inventoryItemId: 'flour-1',
          quantity: 0.4,
          referenceType: 'order',
          referenceId: 'order-1',
        }),
        expect.anything(),
      );
    });

    it('skips stock consumption for products with trackInventory=false', async () => {
      repository.findById.mockResolvedValue(makeOrderRow());
      repository.findItems.mockResolvedValue([makeItemRow()]);
      repository.setStatus.mockResolvedValue(
        makeOrderRow({ status: OrderStatus.CONFIRMED }),
      );

      await service.updateStatus(
        businessId,
        'order-1',
        OrderStatus.CONFIRMED,
        'actor-1',
      );

      expect(movementsService.recordMovement).not.toHaveBeenCalled();
    });

    it('reverses previously consumed stock via RETURN when cancelling a CONFIRMED order', async () => {
      repository.findById.mockResolvedValue(
        makeOrderRow({ status: OrderStatus.CONFIRMED }),
      );
      repository.setStatus.mockResolvedValue(
        makeOrderRow({ status: OrderStatus.CANCELLED }),
      );
      movementsService.getMovementsByReference.mockResolvedValue([
        {
          movementType: InventoryMovementType.SALE_CONSUMPTION,
          inventoryItemId: 'flour-1',
          quantity: 0.4,
          locationId: null,
        },
      ]);

      await service.updateStatus(
        businessId,
        'order-1',
        OrderStatus.CANCELLED,
        'actor-1',
      );

      expect(movementsService.recordMovement).toHaveBeenCalledWith(
        expect.objectContaining({
          movementType: InventoryMovementType.RETURN,
          inventoryItemId: 'flour-1',
          quantity: 0.4,
          referenceType: 'order',
        }),
        expect.anything(),
      );
    });

    it('does not attempt reversal when cancelling directly from PENDING', async () => {
      repository.findById.mockResolvedValue(
        makeOrderRow({ status: OrderStatus.PENDING }),
      );
      repository.setStatus.mockResolvedValue(
        makeOrderRow({ status: OrderStatus.CANCELLED }),
      );

      await service.updateStatus(
        businessId,
        'order-1',
        OrderStatus.CANCELLED,
        'actor-1',
      );

      expect(movementsService.getMovementsByReference).not.toHaveBeenCalled();
    });

    it('records customer stats when an order tied to a customer is delivered', async () => {
      repository.findById.mockResolvedValue(
        makeOrderRow({ status: OrderStatus.READY, customer_id: 'customer-1' }),
      );
      repository.setStatus.mockResolvedValue(
        makeOrderRow({
          status: OrderStatus.DELIVERED,
          customer_id: 'customer-1',
        }),
      );

      await service.updateStatus(
        businessId,
        'order-1',
        OrderStatus.DELIVERED,
        'actor-1',
      );

      expect(customersService.recordCompletedOrder).toHaveBeenCalledWith(
        'customer-1',
        10000,
        expect.anything(),
      );
    });

    it("gates purely on the order's own snapshotted policy — never re-reads the branch's current setting", async () => {
      repository.findById.mockResolvedValue(
        makeOrderRow({
          status: OrderStatus.PENDING,
          payment_policy: 'PREPAY_REQUIRED' as never,
          total_amount: '10000.00',
        }),
      );
      repository.getTotalPaid.mockResolvedValue(10000);
      repository.setStatus.mockResolvedValue(
        makeOrderRow({ status: OrderStatus.CONFIRMED }),
      );
      // The branch could have since flipped to PAY_AT_END (or anything else) — irrelevant,
      // updateStatus must never call out to it; the order's own copy is authoritative.
      branchesService.findOne.mockClear();

      await service.updateStatus(businessId, 'order-1', OrderStatus.CONFIRMED);

      expect(branchesService.findOne).not.toHaveBeenCalled();
    });
  });

  describe('tryAutoConfirm', () => {
    it('confirms normally when payment allows it', async () => {
      repository.findById.mockResolvedValue(
        makeOrderRow({
          status: OrderStatus.PENDING,
          payment_policy: 'PAY_AT_END' as never,
        }),
      );
      repository.setStatus.mockResolvedValue(
        makeOrderRow({ status: OrderStatus.CONFIRMED }),
      );

      const result = await service.tryAutoConfirm(businessId, 'order-1');

      expect(result.status).toBe(OrderStatus.CONFIRMED);
    });

    it('leaves the order PENDING instead of throwing when prepayment is required but missing', async () => {
      repository.findById.mockResolvedValue(
        makeOrderRow({
          status: OrderStatus.PENDING,
          payment_policy: 'PREPAY_REQUIRED' as never,
          total_amount: '10000.00',
        }),
      );
      repository.getTotalPaid.mockResolvedValue(0);

      const result = await service.tryAutoConfirm(businessId, 'order-1');

      expect(result.status).toBe(OrderStatus.PENDING);
      expect(repository.setStatus).not.toHaveBeenCalled();
    });

    it('still rejects for reasons other than a missing prepayment', async () => {
      repository.findById.mockResolvedValue(
        makeOrderRow({ status: OrderStatus.DELIVERED }),
      );

      await expect(
        service.tryAutoConfirm(businessId, 'order-1'),
      ).rejects.toThrow(InvalidOrderStatusTransitionException);
    });
  });

  describe('getKitchenQueue', () => {
    it('delegates to the repository with the branch filter', async () => {
      repository.findActiveForKitchen.mockResolvedValue([makeOrderRow()]);

      const queue = await service.getKitchenQueue(businessId, branchId);

      expect(repository.findActiveForKitchen).toHaveBeenCalledWith(
        businessId,
        branchId,
      );
      expect(queue).toHaveLength(1);
    });
  });

  describe('findActiveIdForTable', () => {
    it('returns the id of the active order for that table', async () => {
      repository.findActiveByTable.mockResolvedValue(
        makeOrderRow({ id: 'order-9' }),
      );

      const id = await service.findActiveIdForTable(businessId, branchId, '5');

      expect(repository.findActiveByTable).toHaveBeenCalledWith(
        businessId,
        branchId,
        '5',
      );
      expect(id).toBe('order-9');
    });

    it('returns null when the table has no active order', async () => {
      repository.findActiveByTable.mockResolvedValue(null);

      const id = await service.findActiveIdForTable(businessId, branchId, '5');

      expect(id).toBeNull();
    });
  });

  describe('getSalesSummary', () => {
    it('parses order_count/total_amount, defaulting total_amount to 0 when null', async () => {
      repository.getSalesSummary.mockResolvedValue({
        order_count: '3',
        total_amount: null,
      });

      const summary = await service.getSalesSummary(
        businessId,
        branchId,
        '2026-01-01',
        '2026-01-31',
      );

      expect(summary).toEqual({ orderCount: 3, totalAmount: 0 });
    });
  });

  describe('getSalesByDay', () => {
    it('maps rows into DailySales entries', async () => {
      repository.getSalesByDay.mockResolvedValue([
        { date: '2026-01-15', order_count: '2', total_amount: '5000.00' },
      ]);

      const result = await service.getSalesByDay(
        businessId,
        branchId,
        '2026-01-01',
        '2026-01-31',
      );

      expect(result).toEqual([
        { date: '2026-01-15', orderCount: 2, totalAmount: 5000 },
      ]);
      // Days are cut in the business's own timezone.
      expect(repository.getSalesByDay).toHaveBeenCalledWith(
        businessId,
        branchId,
        '2026-01-01',
        '2026-01-31',
        'America/Bogota',
      );
    });
  });

  describe('getTopProducts', () => {
    it('maps rows into TopProduct entries', async () => {
      repository.getTopProducts.mockResolvedValue([
        {
          product_id: 'product-1',
          product_name: 'Burger',
          quantity_sold: '10.000',
          revenue: '50000.00',
        },
      ]);

      const result = await service.getTopProducts(
        businessId,
        branchId,
        '2026-01-01',
        '2026-01-31',
        5,
      );

      expect(result).toEqual([
        {
          productId: 'product-1',
          productName: 'Burger',
          quantitySold: 10,
          revenue: 50000,
        },
      ]);
    });
  });

  describe('applyDiscount', () => {
    const orderId = 'order-1';
    const pending = () =>
      makeOrderRow({
        id: orderId,
        subtotal: '20000.00',
        discount_amount: '0.00',
        delivery_fee: '0.00',
        total_amount: '20000.00',
      } as Partial<OrderRow>);

    beforeEach(() => {
      repository.findById.mockResolvedValue(pending());
    });

    it('takes a manual percentage off the subtotal', async () => {
      discountsService.resolve.mockResolvedValue({
        source: 'MANUAL',
        percent: 5,
        discountId: null,
        label: 'Descuento manual (5%)',
      });

      await service.applyDiscount(businessId, orderId, {
        source: 'MANUAL',
        percent: 5,
      });

      // 20000 − 5% = 19000.
      expect(repository.updateTotals).toHaveBeenCalledWith(
        orderId,
        20000,
        1000,
        0,
        0,
        19000,
        expect.anything(),
      );
      expect(repository.setDiscount).toHaveBeenCalledWith(
        orderId,
        expect.objectContaining({ percent: 5, source: 'MANUAL' }),
        expect.anything(),
      );
      expect(discountsService.takeUse).not.toHaveBeenCalled();
    });

    it('counts a use of a coupon', async () => {
      discountsService.resolve.mockResolvedValue({
        source: 'COUPON',
        percent: 10,
        discountId: 'coupon-1',
        label: 'Cupón VERANO10 (10%)',
      });

      await service.applyDiscount(businessId, orderId, {
        source: 'COUPON',
        code: 'verano10',
      });

      expect(discountsService.takeUse).toHaveBeenCalledWith(
        'coupon-1',
        expect.anything(),
      );
      expect(repository.updateTotals).toHaveBeenCalledWith(
        orderId,
        20000,
        2000,
        0,
        0,
        18000,
        expect.anything(),
      );
    });

    it('gives the use back when the discount is removed', async () => {
      repository.findById.mockResolvedValue({
        ...pending(),
        discount_id: 'coupon-1',
        discount_percent: '10',
      });

      await service.applyDiscount(businessId, orderId, { source: 'NONE' });

      expect(discountsService.releaseUse).toHaveBeenCalledWith(
        'coupon-1',
        expect.anything(),
      );
      expect(repository.setDiscount).toHaveBeenCalledWith(
        orderId,
        null,
        expect.anything(),
      );
      expect(repository.updateTotals).toHaveBeenCalledWith(
        orderId,
        20000,
        0,
        0,
        0,
        20000,
        expect.anything(),
      );
    });

    it('refuses once the order has payments', async () => {
      repository.getTotalPaid.mockResolvedValue(5000);

      await expect(
        service.applyDiscount(businessId, orderId, {
          source: 'MANUAL',
          percent: 5,
        }),
      ).rejects.toThrow(BusinessRuleException);
      expect(repository.updateTotals).not.toHaveBeenCalled();
    });

    it('refuses a discount when the business turned them off at checkout', async () => {
      businessesService.getDiscountsAtCheckout.mockResolvedValue(false);

      await expect(
        service.applyDiscount(businessId, orderId, {
          source: 'MANUAL',
          percent: 5,
        }),
      ).rejects.toThrow(BusinessRuleException);
      expect(discountsService.resolve).not.toHaveBeenCalled();
      expect(repository.updateTotals).not.toHaveBeenCalled();
    });

    it('still removes a discount when they are turned off', async () => {
      businessesService.getDiscountsAtCheckout.mockResolvedValue(false);

      await service.applyDiscount(businessId, orderId, { source: 'NONE' });

      expect(repository.setDiscount).toHaveBeenCalledWith(
        orderId,
        null,
        expect.anything(),
      );
    });

    it('refuses a coupon with no uses left', async () => {
      discountsService.resolve.mockResolvedValue({
        source: 'COUPON',
        percent: 10,
        discountId: 'coupon-1',
        label: 'Cupón X (10%)',
      });
      discountsService.takeUse.mockResolvedValue(false);

      await expect(
        service.applyDiscount(businessId, orderId, {
          source: 'COUPON',
          code: 'X',
        }),
      ).rejects.toThrow(BusinessRuleException);
    });
  });

  describe('a percentage discount follows the items', () => {
    it('is recomputed on the new subtotal when items are added', async () => {
      repository.findById.mockResolvedValue(
        makeOrderRow({
          id: 'order-1',
          subtotal: '10000.00',
          discount_amount: '1000.00',
          discount_percent: '10',
          delivery_fee: '0.00',
          total_amount: '9000.00',
        } as Partial<OrderRow>),
      );

      await service.addItems(businessId, 'order-1', [
        { productId, quantity: 2 },
      ]);

      // 10000 + 2 × 5000 = 20000; 10% = 2000.
      expect(repository.updateTotals).toHaveBeenCalledWith(
        'order-1',
        20000,
        2000,
        0,
        0,
        18000,
        expect.anything(),
      );
    });
  });
});
