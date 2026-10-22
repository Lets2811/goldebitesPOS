import {
  BusinessRuleException,
  ConflictException,
  EntityNotFoundException,
} from '../../../common/exceptions';
import { DeliveryRow, DeliveryStatus } from '../domain/delivery.interface';
import { CreateDeliveryInput, DeliveriesService } from './deliveries.service';

describe('DeliveriesService', () => {
  const businessId = 'business-1';
  const actor = 'user-actor';
  let repository: Record<string, jest.Mock>;
  let auditService: { record: jest.Mock };
  let push: { sendToUser: jest.Mock };
  let service: DeliveriesService;

  const settingsRow = {
    business_id: businessId,
    base_fee: '2000.00',
    price_per_unit: '1000.00',
    unit: 'KM',
    unit_size: '1.00',
    billing_mode: 'PROPORTIONAL',
    minimum_fee: '0.00',
    rounding_step: '100.00',
    updated_at: new Date(),
  };

  const makeRow = (overrides: Partial<DeliveryRow> = {}): DeliveryRow =>
    ({
      id: 'delivery-1',
      business_id: businessId,
      branch_id: 'branch-1',
      branch_name: 'Centro',
      order_id: null,
      order_number: null,
      courier_user_id: null,
      courier_first_name: null,
      courier_last_name: null,
      status: 'PENDING',
      tracking_code: 'ABC234',
      origin_latitude: '6.200000',
      origin_longitude: '-75.500000',
      destination_address: 'Calle 10',
      destination_details: null,
      destination_latitude: '6.210000',
      destination_longitude: '-75.510000',
      customer_name: null,
      customer_phone: null,
      notes: null,
      distance_meters: 3420,
      duration_seconds: 600,
      fee: '5500.00',
      pricing: {},
      created_by: actor,
      assigned_at: null,
      picked_up_at: null,
      delivered_at: null,
      cancelled_at: null,
      created_at: new Date(),
      updated_at: new Date(),
      ...overrides,
    }) as DeliveryRow;

  const input: CreateDeliveryInput = {
    branchId: 'branch-1',
    origin: { latitude: 6.2, longitude: -75.5 },
    destination: { latitude: 6.21, longitude: -75.51, address: 'Calle 10' },
    distanceMeters: 3420,
    durationSeconds: 600,
  };

  beforeEach(() => {
    repository = {
      findSettings: jest.fn().mockResolvedValue(settingsRow),
      branchExists: jest.fn().mockResolvedValue(true),
      findOrder: jest
        .fn()
        .mockResolvedValue({ id: 'order-1', status: 'PENDING' }),
      orderHasLiveDelivery: jest.fn().mockResolvedValue(false),
      findCourier: jest.fn().mockResolvedValue({ id: 'courier-1' }),
      create: jest.fn().mockResolvedValue('delivery-1'),
      trackingCodeTaken: jest.fn().mockResolvedValue(false),
      findById: jest.fn().mockResolvedValue(makeRow()),
      setCourier: jest.fn().mockResolvedValue(undefined),
      setStatus: jest.fn().mockResolvedValue(undefined),
      setOrder: jest.fn().mockResolvedValue(undefined),
    };
    auditService = { record: jest.fn().mockResolvedValue(undefined) };
    push = { sendToUser: jest.fn().mockResolvedValue(1) };
    service = new DeliveriesService(
      repository as never,
      auditService as never,
      push as never,
    );
  });

  describe('create', () => {
    it("prices the route with the business's pricing, not the client's", async () => {
      await service.create(businessId, input, actor);

      // 2000 base + 3.42 km × 1000 = 5420, rounded up to 5500.
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ fee: 5500, status: 'PENDING' }),
      );
      const [created] = repository.create.mock.calls[0] as [
        { pricing: { baseFee: number; pricePerUnit: number } },
      ];
      expect(created.pricing).toMatchObject({
        baseFee: 2000,
        pricePerUnit: 1000,
      });
    });

    it('starts assigned when a courier is given', async () => {
      await service.create(
        businessId,
        { ...input, courierUserId: 'courier-1' },
        actor,
      );

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'ASSIGNED',
          courierUserId: 'courier-1',
        }),
      );
    });

    it('needs the pricing to be configured first', async () => {
      repository.findSettings.mockResolvedValue(null);

      await expect(service.create(businessId, input, actor)).rejects.toThrow(
        BusinessRuleException,
      );
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('refuses a branch of another business', async () => {
      repository.branchExists.mockResolvedValue(false);

      await expect(service.create(businessId, input, actor)).rejects.toThrow(
        EntityNotFoundException,
      );
    });

    it('refuses an order that already has a delivery', async () => {
      repository.orderHasLiveDelivery.mockResolvedValue(true);

      await expect(
        service.create(businessId, { ...input, orderId: 'order-1' }, actor),
      ).rejects.toThrow(ConflictException);
    });

    it('refuses a cancelled order', async () => {
      repository.findOrder.mockResolvedValue({
        id: 'order-1',
        status: 'CANCELLED',
      });

      await expect(
        service.create(businessId, { ...input, orderId: 'order-1' }, actor),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('refuses a user who is not a courier', async () => {
      repository.findCourier.mockResolvedValue(null);

      await expect(
        service.create(
          businessId,
          { ...input, courierUserId: 'cashier-1' },
          actor,
        ),
      ).rejects.toThrow(BusinessRuleException);
    });
  });

  describe('changeStatus', () => {
    it.each<[DeliveryStatus, DeliveryStatus]>([
      ['ASSIGNED', 'IN_TRANSIT'],
      ['IN_TRANSIT', 'DELIVERED'],
      ['PENDING', 'CANCELLED'],
    ])('moves %s to %s', async (from, to) => {
      repository.findById.mockResolvedValue(makeRow({ status: from }));

      await service.changeStatus(businessId, 'delivery-1', to, actor);

      expect(repository.setStatus).toHaveBeenCalledWith(
        businessId,
        'delivery-1',
        to,
      );
    });

    it.each<[DeliveryStatus, DeliveryStatus]>([
      ['PENDING', 'IN_TRANSIT'],
      ['DELIVERED', 'CANCELLED'],
      ['CANCELLED', 'DELIVERED'],
    ])('refuses %s to %s', async (from, to) => {
      repository.findById.mockResolvedValue(makeRow({ status: from }));

      await expect(
        service.changeStatus(businessId, 'delivery-1', to, actor),
      ).rejects.toThrow(BusinessRuleException);
      expect(repository.setStatus).not.toHaveBeenCalled();
    });
  });

  describe('assignCourier', () => {
    it('refuses to unassign a delivery on its way', async () => {
      repository.findById.mockResolvedValue(
        makeRow({ status: 'IN_TRANSIT', courier_user_id: 'courier-1' }),
      );

      await expect(
        service.assignCourier(businessId, 'delivery-1', null, actor),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('refuses a finished delivery', async () => {
      repository.findById.mockResolvedValue(makeRow({ status: 'DELIVERED' }));

      await expect(
        service.assignCourier(businessId, 'delivery-1', 'courier-1', actor),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('assigns a courier and audits it', async () => {
      await service.assignCourier(businessId, 'delivery-1', 'courier-1', actor);

      expect(repository.setCourier).toHaveBeenCalledWith(
        businessId,
        'delivery-1',
        'courier-1',
      );
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'ASSIGN_COURIER' }),
      );
    });
  });

  describe('tracking code', () => {
    it('gives each delivery a six-character code without look-alike characters', async () => {
      await service.create(businessId, input, actor);

      const [created] = repository.create.mock.calls[0] as [
        { trackingCode: string },
      ];
      expect(created.trackingCode).toMatch(/^[A-HJKMNP-Z2-9]{6}$/);
    });

    it('draws again when a code is taken', async () => {
      repository.trackingCodeTaken
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);

      await service.create(businessId, input, actor);

      expect(repository.trackingCodeTaken).toHaveBeenCalledTimes(2);
    });
  });

  describe('advanceOwn (courier app)', () => {
    const courier = 'courier-1';

    it('lets the courier start an assigned delivery of their own', async () => {
      repository.findById.mockResolvedValue(
        makeRow({ status: 'ASSIGNED', courier_user_id: courier }),
      );

      await service.advanceOwn(businessId, courier, 'delivery-1', 'IN_TRANSIT');

      expect(repository.setStatus).toHaveBeenCalledWith(
        businessId,
        'delivery-1',
        'IN_TRANSIT',
      );
    });

    it("hides another courier's delivery", async () => {
      repository.findById.mockResolvedValue(
        makeRow({ status: 'ASSIGNED', courier_user_id: 'someone-else' }),
      );

      await expect(
        service.advanceOwn(businessId, courier, 'delivery-1', 'IN_TRANSIT'),
      ).rejects.toThrow(EntityNotFoundException);
    });

    it('does not let the courier skip straight to delivered', async () => {
      repository.findById.mockResolvedValue(
        makeRow({ status: 'ASSIGNED', courier_user_id: courier }),
      );

      await expect(
        service.advanceOwn(businessId, courier, 'delivery-1', 'DELIVERED'),
      ).rejects.toThrow(BusinessRuleException);
    });
  });

  describe('linkOrder (after creating the delivery)', () => {
    it('links an order and audits it', async () => {
      await service.linkOrder(businessId, 'delivery-1', 'order-1', actor);

      expect(repository.setOrder).toHaveBeenCalledWith(
        businessId,
        'delivery-1',
        'order-1',
      );
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'LINK_ORDER' }),
      );
    });

    it('refuses an order that already has another delivery', async () => {
      repository.orderHasLiveDelivery.mockResolvedValue(true);

      await expect(
        service.linkOrder(businessId, 'delivery-1', 'order-1', actor),
      ).rejects.toThrow(ConflictException);
      expect(repository.setOrder).not.toHaveBeenCalled();
    });

    it('does nothing when the order is already the linked one', async () => {
      repository.findById.mockResolvedValue(makeRow({ order_id: 'order-1' }));

      await service.linkOrder(businessId, 'delivery-1', 'order-1', actor);

      expect(repository.setOrder).not.toHaveBeenCalled();
    });

    it('unlinks with null', async () => {
      repository.findById.mockResolvedValue(makeRow({ order_id: 'order-1' }));

      await service.linkOrder(businessId, 'delivery-1', null, actor);

      expect(repository.setOrder).toHaveBeenCalledWith(
        businessId,
        'delivery-1',
        null,
      );
      expect(repository.findOrder).not.toHaveBeenCalled();
    });

    it('refuses a cancelled delivery', async () => {
      repository.findById.mockResolvedValue(makeRow({ status: 'CANCELLED' }));

      await expect(
        service.linkOrder(businessId, 'delivery-1', 'order-1', actor),
      ).rejects.toThrow(BusinessRuleException);
    });
  });

  describe('push to the courier', () => {
    it('tells the courier when a delivery is created assigned to them', async () => {
      repository.findById.mockResolvedValue(
        makeRow({
          status: 'ASSIGNED',
          courier_user_id: 'courier-1',
          courier_first_name: 'Juan',
        }),
      );

      await service.create(
        businessId,
        { ...input, courierUserId: 'courier-1' },
        actor,
      );

      expect(push.sendToUser).toHaveBeenCalledWith(
        'courier-1',
        expect.objectContaining({
          url: '/domiciliario',
          requireInteraction: true,
        }),
      );
    });

    it('does not push when the courier did not change', async () => {
      repository.findById.mockResolvedValue(
        makeRow({ status: 'ASSIGNED', courier_user_id: 'courier-1' }),
      );

      await service.assignCourier(businessId, 'delivery-1', 'courier-1', actor);

      expect(push.sendToUser).not.toHaveBeenCalled();
    });
  });
});
