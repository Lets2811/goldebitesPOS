import { Injectable } from '@nestjs/common';
import { PushNotificationsService } from '../../push-notifications/push-notifications.service';
import {
  BusinessRuleException,
  EntityNotFoundException,
} from '../../../common/exceptions';
import {
  CourierCall,
  CourierCaller,
  CourierPosition,
  CourierTracking,
  Delivery,
  DeliveryHelpRequest,
  DeliveryMessage,
  DeliveryMessageRow,
  DeliveryStatus,
  LatLng,
  PublicTracking,
  PublicTrackingRow,
} from '../domain/delivery.interface';
import { DeliveriesRepository } from '../repositories/deliveries.repository';
import { DeliveryTrackingRepository } from '../repositories/delivery-tracking.repository';
import { DeliveriesService, toDelivery } from './deliveries.service';

/** How long after it ends a delivery's public page keeps answering. */
const PUBLIC_GRACE_MS = 3 * 60 * 60 * 1000;
/** A position older than this is not shown as "where the courier is". */
const LIVE_POSITION_MS = 10 * 60 * 1000;
const TRAIL_POINTS = 300;
const MESSAGES_PAGE = 200;
const OPEN_FOR_ADMIN: DeliveryStatus[] = ['ASSIGNED', 'IN_TRANSIT'];
/** A call repeated sooner than this (and not seen yet) does not ring again. */
const CALL_GAP_SECONDS = 20;
const COURIER_APP_URL = '/domiciliario';

const isClosed = (status: DeliveryStatus) =>
  status === 'DELIVERED' || status === 'CANCELLED';

const toMessage = (row: DeliveryMessageRow): DeliveryMessage => ({
  id: row.id,
  sender: row.sender,
  senderName: row.sender === 'CUSTOMER' ? null : row.first_name,
  body: row.body,
  createdAt: row.created_at,
});

const point = (latitude: string, longitude: string): LatLng => ({
  latitude: Number(latitude),
  longitude: Number(longitude),
});

/**
 * Following deliveries: the courier's phone reports where it is, the admin
 * sees every courier on a map, the customer follows theirs on a public page
 * opened with the delivery's code, and the three of them chat.
 */
@Injectable()
export class DeliveryTrackingService {
  constructor(
    private readonly trackingRepository: DeliveryTrackingRepository,
    private readonly deliveriesRepository: DeliveriesRepository,
    private readonly deliveriesService: DeliveriesService,
    private readonly push: PushNotificationsService,
  ) {}

  async reportPosition(
    businessId: string,
    courierUserId: string,
    position: CourierPosition,
  ): Promise<{ trackedDeliveries: number }> {
    const trackedDeliveries = await this.trackingRepository.saveCourierPosition(
      businessId,
      courierUserId,
      position,
    );
    return { trackedDeliveries };
  }

  /** Every courier of the business, where they are, and their open deliveries (with the path ridden). */
  async getTracking(businessId: string): Promise<CourierTracking[]> {
    const [couriers, ...open] = await Promise.all([
      this.trackingRepository.findCourierLocations(businessId),
      ...OPEN_FOR_ADMIN.map((status) =>
        this.deliveriesRepository.findAll(businessId, { status }, 300),
      ),
    ]);
    const deliveries = open.flat().map(toDelivery);
    const inTransit = deliveries.filter((d) => d.status === 'IN_TRANSIT');
    const points = await this.trackingRepository.findTrackPoints(
      inTransit.map((d) => d.id),
      TRAIL_POINTS,
    );
    const trails = new Map<string, LatLng[]>();
    for (const p of points) {
      const trail = trails.get(p.delivery_id) ?? [];
      trail.push(point(p.latitude, p.longitude));
      trails.set(p.delivery_id, trail);
    }

    return couriers.map((courier) => ({
      courierId: courier.user_id,
      name: `${courier.first_name} ${courier.last_name}`.trim(),
      location:
        courier.latitude !== null &&
        courier.longitude !== null &&
        courier.recorded_at
          ? {
              ...point(courier.latitude, courier.longitude),
              accuracyMeters: courier.accuracy_meters,
              recordedAt: courier.recorded_at,
            }
          : null,
      deliveries: deliveries
        .filter((d) => d.courier?.id === courier.user_id)
        .map((d) => ({ ...d, trail: trails.get(d.id) ?? [] })),
    }));
  }

  // ---- Chat, as staff (any delivery of the business) ----

  async listMessagesAsStaff(
    businessId: string,
    deliveryId: string,
    after?: Date,
  ): Promise<DeliveryMessage[]> {
    await this.deliveriesService.findOne(businessId, deliveryId);
    return this.listMessages(deliveryId, after);
  }

  async sendAsStaff(
    businessId: string,
    userId: string,
    deliveryId: string,
    body: string,
  ): Promise<DeliveryMessage> {
    const delivery = await this.deliveriesService.findOne(
      businessId,
      deliveryId,
    );
    this.assertChatOpen(delivery.status);
    const message = toMessage(
      await this.trackingRepository.insertMessage(
        deliveryId,
        'STAFF',
        userId,
        body.trim(),
      ),
    );
    if (delivery.courier) {
      void this.push.sendToUser(delivery.courier.id, {
        title: `Mensaje del restaurante · ${delivery.trackingCode}`,
        body: message.body,
        tag: `chat-${deliveryId}`,
        url: COURIER_APP_URL,
      });
    }
    return message;
  }

  // ---- Chat, as the courier (their own deliveries only) ----

  async listMessagesAsCourier(
    businessId: string,
    courierUserId: string,
    deliveryId: string,
    after?: Date,
  ): Promise<DeliveryMessage[]> {
    await this.deliveriesService.getOwnRowOrFail(
      businessId,
      courierUserId,
      deliveryId,
    );
    return this.listMessages(deliveryId, after);
  }

  async sendAsCourier(
    businessId: string,
    courierUserId: string,
    deliveryId: string,
    body: string,
  ): Promise<DeliveryMessage> {
    const row = await this.deliveriesService.getOwnRowOrFail(
      businessId,
      courierUserId,
      deliveryId,
    );
    this.assertChatOpen(row.status);
    return toMessage(
      await this.trackingRepository.insertMessage(
        deliveryId,
        'COURIER',
        courierUserId,
        body.trim(),
      ),
    );
  }

  // ---- The customer's public page (no login: the code is the key) ----

  async getPublic(code: string): Promise<PublicTracking> {
    const row = await this.getPublicRowOrFail(code);
    const items = row.order_id
      ? await this.trackingRepository.findPublicOrderItems(row.order_id)
      : [];
    const live =
      row.status === 'IN_TRANSIT' &&
      row.courier_latitude !== null &&
      row.courier_longitude !== null &&
      row.courier_recorded_at !== null &&
      Date.now() - row.courier_recorded_at.getTime() < LIVE_POSITION_MS;
    return {
      code: code.toUpperCase(),
      status: row.status,
      businessName: row.business_name,
      branchName: row.branch_name,
      origin: point(row.origin_latitude, row.origin_longitude),
      destination: {
        ...point(row.destination_latitude, row.destination_longitude),
        address: row.destination_address,
      },
      courier: row.courier_user_id
        ? {
            name:
              [row.courier_first_name, row.courier_last_name]
                .filter(Boolean)
                .join(' ') || 'Tu domiciliario',
            location: live
              ? {
                  ...point(row.courier_latitude!, row.courier_longitude!),
                  recordedAt: row.courier_recorded_at!,
                }
              : null,
          }
        : null,
      createdAt: row.created_at,
      assignedAt: row.assigned_at,
      pickedUpAt: row.picked_up_at,
      deliveredAt: row.delivered_at,
      cancelledAt: row.cancelled_at,
      chatOpen: !isClosed(row.status),
      helpPending: row.help_pending,
      fee: Number(row.fee),
      order:
        row.order_id && row.order_number
          ? {
              orderNumber: row.order_number,
              items: items.map((item) => ({
                name: item.product_name_snapshot,
                quantity: Number(item.quantity),
                unitPrice: Number(item.unit_price),
                total: Number(item.total_price),
                notes: item.notes,
                options: (item.option_selections ?? [])
                  .filter((selection) => selection.itemNames.length > 0)
                  .map(
                    (selection) =>
                      `${selection.groupName}: ${selection.itemNames.join(', ')}`,
                  ),
              })),
              subtotal: Number(row.order_subtotal ?? 0),
              discount: Number(row.order_discount ?? 0),
              tax: Number(row.order_tax ?? 0),
              total: Number(row.order_total ?? 0),
              paymentStatus: row.order_payment_status ?? 'PENDING',
              includesDeliveryFee: Number(row.order_delivery_fee ?? 0) > 0,
              orderDeliveryFee: Number(row.order_delivery_fee ?? 0),
            }
          : null,
    };
  }

  // ---- "Llamar al domiciliario" ----

  /** The restaurant calls the courier of a delivery (from the POS). */
  async callCourierAsStaff(
    businessId: string,
    staffUserId: string,
    deliveryId: string,
  ): Promise<{ called: boolean; devices: number }> {
    const delivery = await this.deliveriesService.findOne(
      businessId,
      deliveryId,
    );
    this.assertOpen(delivery.status);
    if (!delivery.courier) {
      throw new BusinessRuleException(
        'El domicilio no tiene domiciliario asignado',
        'DELIVERY_NO_COURIER',
      );
    }
    return this.ringCourier(
      delivery.id,
      delivery.courier.id,
      'STAFF',
      staffUserId,
      `El restaurante te está llamando · ${delivery.trackingCode}`,
      delivery.destination.address,
    );
  }

  /** The customer calls their courier (from the tracking page). */
  async callCourierAsCustomer(
    code: string,
  ): Promise<{ called: boolean; devices: number }> {
    const row = await this.getPublicRowOrFail(code);
    this.assertOpen(row.status);
    if (!row.courier_user_id) {
      throw new BusinessRuleException(
        'Tu domicilio aún no tiene domiciliario asignado',
        'DELIVERY_NO_COURIER',
      );
    }
    return this.ringCourier(
      row.id,
      row.courier_user_id,
      'CUSTOMER',
      null,
      `Tu cliente te está llamando · ${code.toUpperCase()}`,
      row.destination_address,
    );
  }

  async getMyCalls(
    businessId: string,
    courierUserId: string,
  ): Promise<CourierCall[]> {
    const rows = await this.trackingRepository.findOpenCourierCalls(
      businessId,
      courierUserId,
    );
    return rows.map((row) => ({
      id: row.id,
      deliveryId: row.delivery_id,
      calledBy: row.called_by,
      staffName: row.staff_first_name,
      createdAt: row.created_at,
      delivery: {
        trackingCode: row.tracking_code,
        address: row.destination_address,
        customerName: row.customer_name,
      },
    }));
  }

  async markCallsSeen(
    businessId: string,
    courierUserId: string,
    deliveryId: string,
  ): Promise<void> {
    await this.trackingRepository.markCourierCallsSeen(
      businessId,
      courierUserId,
      deliveryId,
    );
  }

  private async ringCourier(
    deliveryId: string,
    courierUserId: string,
    calledBy: CourierCaller,
    staffUserId: string | null,
    title: string,
    address: string,
  ): Promise<{ called: boolean; devices: number }> {
    const called = await this.trackingRepository.createCourierCall(
      deliveryId,
      courierUserId,
      calledBy,
      staffUserId,
      CALL_GAP_SECONDS,
    );
    if (!called) return { called: false, devices: 0 };
    const devices = await this.push.sendToUser(courierUserId, {
      title,
      body: `${address}. Abre la app para responder.`,
      tag: `call-${deliveryId}`,
      url: COURIER_APP_URL,
      requireInteraction: true,
    });
    return { called: true, devices };
  }

  // ---- "Llamar al restaurante" ----

  /** The customer asks the restaurant to look at their delivery. */
  async callRestaurantAsCustomer(
    code: string,
    reason?: string,
  ): Promise<PublicTracking> {
    const row = await this.getPublicRowOrFail(code);
    this.assertOpen(row.status);
    await this.trackingRepository.openHelpRequest(
      row.id,
      'CUSTOMER',
      reason?.trim() || null,
    );
    return this.getPublic(code);
  }

  /** The courier asks the restaurant for help with one of their deliveries. */
  async callRestaurantAsCourier(
    businessId: string,
    courierUserId: string,
    deliveryId: string,
    reason?: string,
  ): Promise<void> {
    const row = await this.deliveriesService.getOwnRowOrFail(
      businessId,
      courierUserId,
      deliveryId,
    );
    this.assertOpen(row.status);
    await this.trackingRepository.openHelpRequest(
      deliveryId,
      'COURIER',
      reason?.trim() || null,
    );
  }

  async getPendingHelpRequests(
    businessId: string,
  ): Promise<DeliveryHelpRequest[]> {
    const rows =
      await this.trackingRepository.findPendingHelpRequests(businessId);
    return rows.map((row) => ({
      id: row.id,
      deliveryId: row.delivery_id,
      branchId: row.branch_id,
      requestedBy: row.requested_by,
      reason: row.reason,
      createdAt: row.created_at,
      delivery: {
        trackingCode: row.tracking_code,
        status: row.status,
        address: row.destination_address,
        customerName: row.customer_name,
        customerPhone: row.customer_phone,
        orderNumber: row.order_number,
        courierName: row.courier_first_name
          ? `${row.courier_first_name} ${row.courier_last_name ?? ''}`.trim()
          : null,
      },
    }));
  }

  async attendHelpRequest(
    businessId: string,
    id: string,
    userId: string,
  ): Promise<void> {
    const attended = await this.trackingRepository.attendHelpRequest(
      businessId,
      id,
      userId,
    );
    if (!attended) {
      // Most likely a colleague attended it first.
      throw new EntityNotFoundException('DeliveryHelpRequest', id);
    }
  }

  async listPublicMessages(
    code: string,
    after?: Date,
  ): Promise<DeliveryMessage[]> {
    const row = await this.getPublicRowOrFail(code);
    return this.listMessages(row.id, after);
  }

  async sendAsCustomer(code: string, body: string): Promise<DeliveryMessage> {
    const row = await this.getPublicRowOrFail(code);
    this.assertChatOpen(row.status);
    const message = toMessage(
      await this.trackingRepository.insertMessage(
        row.id,
        'CUSTOMER',
        null,
        body.trim(),
      ),
    );
    if (row.courier_user_id) {
      void this.push.sendToUser(row.courier_user_id, {
        title: `Mensaje del cliente · ${code.toUpperCase()}`,
        body: message.body,
        tag: `chat-${row.id}`,
        url: COURIER_APP_URL,
      });
    }
    return message;
  }

  private async getPublicRowOrFail(code: string): Promise<PublicTrackingRow> {
    const row = await this.trackingRepository.findPublicByCode(
      code.trim().toUpperCase(),
    );
    const endedAt = row?.delivered_at ?? row?.cancelled_at ?? null;
    // Not found and expired look the same: nothing to learn by guessing codes.
    if (!row || (endedAt && Date.now() - endedAt.getTime() > PUBLIC_GRACE_MS)) {
      throw new EntityNotFoundException('Delivery', code);
    }
    return row;
  }

  private async listMessages(
    deliveryId: string,
    after?: Date,
  ): Promise<DeliveryMessage[]> {
    const rows = await this.trackingRepository.findMessages(
      deliveryId,
      after ?? null,
      MESSAGES_PAGE,
    );
    return rows.map(toMessage);
  }

  private assertOpen(status: Delivery['status']): void {
    if (isClosed(status)) {
      throw new BusinessRuleException(
        'El domicilio ya terminó',
        'DELIVERY_CLOSED',
      );
    }
  }

  private assertChatOpen(status: Delivery['status']): void {
    if (isClosed(status)) {
      throw new BusinessRuleException(
        'El domicilio ya terminó: el chat está cerrado',
        'DELIVERY_CHAT_CLOSED',
      );
    }
  }
}
