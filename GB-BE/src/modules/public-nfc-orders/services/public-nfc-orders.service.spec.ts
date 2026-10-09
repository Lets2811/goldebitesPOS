import { BusinessRuleException, ConflictException } from '../../../common/exceptions';
import { OrderStatus, OrderType } from '../../orders/domain/order.interface';
import { PublicNfcOrdersService } from './public-nfc-orders.service';

describe('PublicNfcOrdersService', () => {
  let nfcTagsService: { resolvePublic: jest.Mock };
  let ordersService: {
    create: jest.Mock;
    tryAutoConfirm: jest.Mock;
    addItems: jest.Mock;
    findActiveIdForTable: jest.Mock;
    findOne: jest.Mock;
  };
  let submissionsRepository: {
    claim: jest.Mock;
    findByKey: jest.Mock;
    linkOrder: jest.Mock;
    deleteUnresolvedClaim: jest.Mock;
  };
  let service: PublicNfcOrdersService;

  const businessId = 'business-1';
  const branchId = 'branch-1';
  const tableNumber = '5';
  const token = 'raw-token';
  const idempotencyKey = 'key-1';
  const items = [{ productId: 'product-1', quantity: 2 }];

  function makeOrder(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      id: 'order-1',
      orderNumber: '0921-01',
      status: OrderStatus.CONFIRMED,
      orderType: OrderType.DINE_IN,
      tableNumber,
      totalAmount: 20000,
      createdAt: new Date(),
      items: [],
      ...overrides,
    };
  }

  beforeEach(() => {
    nfcTagsService = {
      resolvePublic: jest.fn().mockResolvedValue({
        businessId,
        branchId,
        businessName: 'Golden Bites',
        tableNumber,
        selfServiceEnabled: true,
      }),
    };
    ordersService = {
      create: jest.fn().mockResolvedValue(makeOrder()),
      tryAutoConfirm: jest.fn().mockResolvedValue(makeOrder()),
      addItems: jest.fn().mockResolvedValue(makeOrder()),
      findActiveIdForTable: jest.fn().mockResolvedValue(null),
      findOne: jest.fn().mockResolvedValue(makeOrder()),
    };
    submissionsRepository = {
      claim: jest.fn().mockResolvedValue(true),
      findByKey: jest.fn(),
      linkOrder: jest.fn(),
      deleteUnresolvedClaim: jest.fn(),
    };
    service = new PublicNfcOrdersService(
      nfcTagsService as never,
      ordersService as never,
      submissionsRepository as never,
    );
  });

  describe('submit — create vs. append', () => {
    it('creates and auto-confirms a new order when the table has no active order', async () => {
      ordersService.findActiveIdForTable.mockResolvedValue(null);

      await service.submit(token, { orderType: OrderType.DINE_IN, idempotencyKey, items } as never);

      expect(ordersService.create).toHaveBeenCalledWith(
        { businessId, branchId, orderType: OrderType.DINE_IN, tableNumber },
        items,
      );
      expect(ordersService.tryAutoConfirm).toHaveBeenCalledWith(businessId, 'order-1');
      expect(ordersService.addItems).not.toHaveBeenCalled();
      expect(submissionsRepository.linkOrder).toHaveBeenCalledWith(idempotencyKey, 'order-1');
    });

    it('appends to the active order via addItems, without creating a new one', async () => {
      ordersService.findActiveIdForTable.mockResolvedValue('existing-order');

      await service.submit(token, { orderType: OrderType.DINE_IN, idempotencyKey, items } as never);

      expect(ordersService.addItems).toHaveBeenCalledWith(businessId, 'existing-order', items);
      expect(ordersService.create).not.toHaveBeenCalled();
      expect(submissionsRepository.linkOrder).toHaveBeenCalledWith(idempotencyKey, 'existing-order');
    });

    it('TAKEAWAY always creates a new order and never checks/merges into any table order', async () => {
      await service.submit(token, { orderType: OrderType.TAKEAWAY, idempotencyKey, items } as never);

      expect(ordersService.findActiveIdForTable).not.toHaveBeenCalled();
      expect(ordersService.create).toHaveBeenCalledWith(
        { businessId, branchId, orderType: OrderType.TAKEAWAY },
        items,
      );
      expect(ordersService.tryAutoConfirm).toHaveBeenCalledWith(businessId, 'order-1');
    });
  });

  describe('submit — self-service', () => {
    it('refuses the order, before claiming anything, when the table has self-service off', async () => {
      nfcTagsService.resolvePublic.mockResolvedValue({
        businessId,
        branchId,
        businessName: 'Golden Bites',
        tableNumber,
        selfServiceEnabled: false,
      });

      await expect(
        service.submit(token, { orderType: OrderType.DINE_IN, idempotencyKey, items } as never),
      ).rejects.toThrow(BusinessRuleException);
      expect(submissionsRepository.claim).not.toHaveBeenCalled();
      expect(ordersService.create).not.toHaveBeenCalled();
      expect(ordersService.addItems).not.toHaveBeenCalled();
    });
  });

  describe('submit — idempotency', () => {
    it('replays a completed submission instead of duplicating it', async () => {
      submissionsRepository.claim.mockResolvedValue(false);
      submissionsRepository.findByKey.mockResolvedValue({
        idempotency_key: idempotencyKey,
        order_id: 'already-created-order',
        created_at: new Date(),
      });

      const result = await service.submit(token, { orderType: OrderType.DINE_IN, idempotencyKey, items } as never);

      expect(ordersService.create).not.toHaveBeenCalled();
      expect(ordersService.addItems).not.toHaveBeenCalled();
      expect(ordersService.findOne).toHaveBeenCalledWith(businessId, 'already-created-order');
      expect(result.id).toBe('order-1'); // from the mocked findOne() return value
    });

    it('rejects a still-in-flight duplicate (recent unresolved claim) instead of racing a second order', async () => {
      submissionsRepository.claim.mockResolvedValue(false);
      submissionsRepository.findByKey.mockResolvedValue({
        idempotency_key: idempotencyKey,
        order_id: null,
        created_at: new Date(),
      });

      await expect(
        service.submit(token, { orderType: OrderType.DINE_IN, idempotencyKey, items } as never),
      ).rejects.toThrow(ConflictException);
      expect(ordersService.create).not.toHaveBeenCalled();
      expect(ordersService.addItems).not.toHaveBeenCalled();
    });

    it('frees and retries once for an abandoned claim older than the staleness window', async () => {
      submissionsRepository.claim.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
      submissionsRepository.findByKey.mockResolvedValue({
        idempotency_key: idempotencyKey,
        order_id: null,
        created_at: new Date(Date.now() - 40_000),
      });

      await service.submit(token, { orderType: OrderType.DINE_IN, idempotencyKey, items } as never);

      expect(submissionsRepository.deleteUnresolvedClaim).toHaveBeenCalledWith(idempotencyKey);
      expect(submissionsRepository.claim).toHaveBeenCalledTimes(2);
      expect(ordersService.create).toHaveBeenCalled();
    });

    it('cleans up its claim and rethrows if creating/appending the order fails', async () => {
      ordersService.create.mockRejectedValue(new Error('boom'));

      await expect(
        service.submit(token, { orderType: OrderType.DINE_IN, idempotencyKey, items } as never),
      ).rejects.toThrow('boom');
      expect(submissionsRepository.deleteUnresolvedClaim).toHaveBeenCalledWith(idempotencyKey);
      expect(submissionsRepository.linkOrder).not.toHaveBeenCalled();
    });
  });

  describe('getStatus', () => {
    it('resolves the token and returns the public view of that order', async () => {
      const result = await service.getStatus(token, 'order-1');

      expect(nfcTagsService.resolvePublic).toHaveBeenCalledWith(token);
      expect(ordersService.findOne).toHaveBeenCalledWith(businessId, 'order-1');
      expect(result.id).toBe('order-1');
    });
  });
});
