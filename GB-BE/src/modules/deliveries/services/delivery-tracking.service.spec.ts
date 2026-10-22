import {
  BusinessRuleException,
  EntityNotFoundException,
} from '../../../common/exceptions';
import { PublicTrackingRow } from '../domain/delivery.interface';
import { DeliveryTrackingService } from './delivery-tracking.service';

describe('DeliveryTrackingService', () => {
  let trackingRepository: Record<string, jest.Mock>;
  let push: { sendToUser: jest.Mock };
  let service: DeliveryTrackingService;

  const minutesAgo = (minutes: number) =>
    new Date(Date.now() - minutes * 60_000);

  const publicRow = (
    overrides: Partial<PublicTrackingRow> = {},
  ): PublicTrackingRow => ({
    id: 'delivery-1',
    status: 'IN_TRANSIT',
    business_name: 'Golden Bites',
    branch_name: 'Centro',
    origin_latitude: '6.200000',
    origin_longitude: '-75.500000',
    destination_address: 'Calle 10',
    destination_latitude: '6.210000',
    destination_longitude: '-75.510000',
    courier_user_id: 'courier-1',
    courier_first_name: 'Juan',
    courier_last_name: 'Pérez',
    fee: '5500.00',
    order_id: null,
    order_number: null,
    order_subtotal: null,
    order_discount: null,
    order_tax: null,
    order_delivery_fee: null,
    order_total: null,
    order_payment_status: null,
    courier_latitude: '6.205000',
    courier_longitude: '-75.505000',
    courier_recorded_at: minutesAgo(1),
    created_at: minutesAgo(30),
    assigned_at: minutesAgo(25),
    picked_up_at: minutesAgo(10),
    delivered_at: null,
    cancelled_at: null,
    help_pending: false,
    ...overrides,
  });

  beforeEach(() => {
    trackingRepository = {
      findPublicByCode: jest.fn().mockResolvedValue(publicRow()),
      insertMessage: jest.fn().mockResolvedValue({
        id: 'm1',
        delivery_id: 'delivery-1',
        sender: 'CUSTOMER',
        user_id: null,
        first_name: null,
        body: 'Hola',
        created_at: new Date(),
      }),
      findMessages: jest.fn().mockResolvedValue([]),
      openHelpRequest: jest.fn().mockResolvedValue(undefined),
      findPublicOrderItems: jest.fn().mockResolvedValue([]),
      createCourierCall: jest.fn().mockResolvedValue(true),
      attendHelpRequest: jest.fn().mockResolvedValue(true),
    };
    push = { sendToUser: jest.fn().mockResolvedValue(1) };
    service = new DeliveryTrackingService(
      trackingRepository as never,
      {} as never,
      {} as never,
      push as never,
    );
  });

  describe('getPublic', () => {
    it('shows where the courier is while on the way, case-insensitively', async () => {
      const tracking = await service.getPublic('abc234');

      expect(trackingRepository.findPublicByCode).toHaveBeenCalledWith(
        'ABC234',
      );
      expect(tracking.courier).toEqual({
        name: 'Juan Pérez',
        location: expect.objectContaining({
          latitude: 6.205,
          longitude: -75.505,
        }) as unknown,
      });
      expect(tracking.chatOpen).toBe(true);
    });

    it('does not show a stale position as live', async () => {
      trackingRepository.findPublicByCode.mockResolvedValue(
        publicRow({ courier_recorded_at: minutesAgo(30) }),
      );

      const tracking = await service.getPublic('ABC234');

      expect(tracking.courier?.location).toBeNull();
    });

    it('stops answering hours after the delivery ended', async () => {
      trackingRepository.findPublicByCode.mockResolvedValue(
        publicRow({ status: 'DELIVERED', delivered_at: minutesAgo(4 * 60) }),
      );

      await expect(service.getPublic('ABC234')).rejects.toThrow(
        EntityNotFoundException,
      );
    });

    it('still answers right after it was delivered, with the chat closed', async () => {
      trackingRepository.findPublicByCode.mockResolvedValue(
        publicRow({ status: 'DELIVERED', delivered_at: minutesAgo(5) }),
      );

      const tracking = await service.getPublic('ABC234');

      expect(tracking.chatOpen).toBe(false);
      expect(tracking.courier?.location).toBeNull();
    });

    it('answers an unknown code as not found', async () => {
      trackingRepository.findPublicByCode.mockResolvedValue(null);

      await expect(service.getPublic('ZZZZZZ')).rejects.toThrow(
        EntityNotFoundException,
      );
    });
  });

  describe('sendAsCustomer', () => {
    it('writes as the customer, trimmed', async () => {
      await service.sendAsCustomer('ABC234', '  Hola  ');

      expect(trackingRepository.insertMessage).toHaveBeenCalledWith(
        'delivery-1',
        'CUSTOMER',
        null,
        'Hola',
      );
    });

    it('refuses once the delivery is over', async () => {
      trackingRepository.findPublicByCode.mockResolvedValue(
        publicRow({ status: 'CANCELLED', cancelled_at: minutesAgo(1) }),
      );

      await expect(service.sendAsCustomer('ABC234', 'Hola')).rejects.toThrow(
        BusinessRuleException,
      );
    });
  });

  describe('call the restaurant', () => {
    it('opens a call from the customer, with the reason trimmed', async () => {
      await service.callRestaurantAsCustomer('ABC234', '  Llegó frío  ');

      expect(trackingRepository.openHelpRequest).toHaveBeenCalledWith(
        'delivery-1',
        'CUSTOMER',
        'Llegó frío',
      );
    });

    it('refuses a delivery that already ended', async () => {
      trackingRepository.findPublicByCode.mockResolvedValue(
        publicRow({ status: 'DELIVERED', delivered_at: minutesAgo(5) }),
      );

      await expect(service.callRestaurantAsCustomer('ABC234')).rejects.toThrow(
        BusinessRuleException,
      );
      expect(trackingRepository.openHelpRequest).not.toHaveBeenCalled();
    });

    it('reports a call a colleague already attended as not found', async () => {
      trackingRepository.attendHelpRequest.mockResolvedValue(false);

      await expect(
        service.attendHelpRequest('business-1', 'help-1', 'user-1'),
      ).rejects.toThrow(EntityNotFoundException);
    });
  });

  describe('order detail on the public page', () => {
    it('shows the linked order with its items, options and costs, and the delivery fee', async () => {
      trackingRepository.findPublicByCode.mockResolvedValue(
        publicRow({
          order_id: 'order-1',
          order_number: '1017',
          order_subtotal: '42000.00',
          order_discount: '2000.00',
          order_tax: '0.00',
          order_delivery_fee: '0.00',
          order_total: '40000.00',
          order_payment_status: 'PENDING',
        }),
      );
      trackingRepository.findPublicOrderItems.mockResolvedValue([
        {
          product_name_snapshot: 'Hamburguesa',
          quantity: '2.000',
          unit_price: '21000.00',
          total_price: '42000.00',
          notes: 'Sin cebolla',
          option_selections: [
            { groupName: 'Salsas', itemNames: ['BBQ', 'Ajo'] },
            { groupName: 'Bebida', itemNames: [] },
          ],
        },
      ]);

      const tracking = await service.getPublic('ABC234');

      expect(tracking.fee).toBe(5500);
      expect(tracking.order).toEqual({
        orderNumber: '1017',
        items: [
          {
            name: 'Hamburguesa',
            quantity: 2,
            unitPrice: 21000,
            total: 42000,
            notes: 'Sin cebolla',
            options: ['Salsas: BBQ, Ajo'],
          },
        ],
        subtotal: 42000,
        discount: 2000,
        tax: 0,
        total: 40000,
        paymentStatus: 'PENDING',
        includesDeliveryFee: false,
        orderDeliveryFee: 0,
      });
    });

    it('has no order for a delivery not linked to one', async () => {
      const tracking = await service.getPublic('ABC234');

      expect(tracking.order).toBeNull();
      expect(trackingRepository.findPublicOrderItems).not.toHaveBeenCalled();
    });
  });

  describe('call the courier (customer)', () => {
    it("rings the courier's phone", async () => {
      const result = await service.callCourierAsCustomer('abc234');

      expect(trackingRepository.createCourierCall).toHaveBeenCalledWith(
        'delivery-1',
        'courier-1',
        'CUSTOMER',
        null,
        expect.any(Number),
      );
      expect(push.sendToUser).toHaveBeenCalledWith(
        'courier-1',
        expect.objectContaining({
          requireInteraction: true,
          tag: 'call-delivery-1',
        }),
      );
      expect(result).toEqual({ called: true, devices: 1 });
    });

    it('does not ring again for a call repeated right away', async () => {
      trackingRepository.createCourierCall.mockResolvedValue(false);

      const result = await service.callCourierAsCustomer('ABC234');

      expect(push.sendToUser).not.toHaveBeenCalled();
      expect(result.called).toBe(false);
    });

    it('refuses while no courier is assigned', async () => {
      trackingRepository.findPublicByCode.mockResolvedValue(
        publicRow({ status: 'PENDING', courier_user_id: null }),
      );

      await expect(service.callCourierAsCustomer('ABC234')).rejects.toThrow(
        BusinessRuleException,
      );
    });
  });

  it('pushes a customer message to the courier', async () => {
    await service.sendAsCustomer('ABC234', 'Ya estoy afuera');

    expect(push.sendToUser).toHaveBeenCalledWith(
      'courier-1',
      expect.objectContaining({ body: 'Hola', tag: 'chat-delivery-1' }),
    );
  });
});
