import { Injectable } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import {
  BusinessRuleException,
  ConflictException,
  EntityNotFoundException,
} from '../../../common/exceptions';
import { AuditService } from '../../audit/services/audit.service';
import { PushNotificationsService } from '../../push-notifications/push-notifications.service';
import { DeliveryPricing, quoteDelivery } from '../domain/delivery-pricing';
import {
  BranchLocation,
  Courier,
  CourierBalance,
  CourierScope,
  Delivery,
  DeliveryFilters,
  DeliveryRow,
  DeliverySettings,
  DeliverySettingsRow,
  DeliveryStatus,
  LatLng,
  LinkableOrder,
} from '../domain/delivery.interface';
import { DeliveriesRepository } from '../repositories/deliveries.repository';

/** What a new business starts with until it saves its own pricing. */
const DEFAULT_PRICING: DeliveryPricing = {
  baseFee: 0,
  pricePerUnit: 0,
  unit: 'KM',
  unitSize: 1,
  billingMode: 'PROPORTIONAL',
  minimumFee: 0,
  roundingStep: 100,
};

const MAX_LISTED = 300;
const MAX_COURIER_LISTED = 100;

/** Tracking codes: no look-alike characters (0/O, 1/I/L), to be read out or typed. */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;
const CODE_ATTEMPTS = 5;

/** What a courier may do with their own deliveries from the app. */
const COURIER_NEXT: Partial<Record<DeliveryStatus, DeliveryStatus[]>> = {
  ASSIGNED: ['IN_TRANSIT'],
  IN_TRANSIT: ['DELIVERED'],
};
const MAX_LINKABLE_ORDERS = 30;

/** Where a delivery can go from each status (the courier is set apart, see assignCourier). */
const NEXT_STATUSES: Record<DeliveryStatus, DeliveryStatus[]> = {
  PENDING: ['CANCELLED'],
  ASSIGNED: ['IN_TRANSIT', 'DELIVERED', 'CANCELLED'],
  IN_TRANSIT: ['DELIVERED', 'CANCELLED'],
  DELIVERED: [],
  CANCELLED: [],
};

const toPricing = (row: DeliverySettingsRow): DeliveryPricing => ({
  baseFee: Number(row.base_fee),
  pricePerUnit: Number(row.price_per_unit),
  unit: row.unit,
  unitSize: Number(row.unit_size),
  billingMode: row.billing_mode,
  minimumFee: Number(row.minimum_fee),
  roundingStep: Number(row.rounding_step),
});

export const toDelivery = (row: DeliveryRow): Delivery => ({
  id: row.id,
  branchId: row.branch_id,
  branchName: row.branch_name,
  orderId: row.order_id,
  orderNumber: row.order_number,
  courier: row.courier_user_id
    ? {
        id: row.courier_user_id,
        name: `${row.courier_first_name ?? ''} ${row.courier_last_name ?? ''}`.trim(),
      }
    : null,
  status: row.status,
  trackingCode: row.tracking_code,
  origin: {
    latitude: Number(row.origin_latitude),
    longitude: Number(row.origin_longitude),
  },
  destination: {
    address: row.destination_address,
    details: row.destination_details,
    latitude: Number(row.destination_latitude),
    longitude: Number(row.destination_longitude),
  },
  customerName: row.customer_name,
  customerPhone: row.customer_phone,
  notes: row.notes,
  distanceMeters: row.distance_meters,
  durationSeconds: row.duration_seconds,
  fee: Number(row.fee),
  pricing: row.pricing,
  assignedAt: row.assigned_at,
  pickedUpAt: row.picked_up_at,
  deliveredAt: row.delivered_at,
  cancelledAt: row.cancelled_at,
  createdAt: row.created_at,
});

export interface CreateDeliveryInput {
  branchId: string;
  orderId?: string | null;
  courierUserId?: string | null;
  origin: LatLng;
  destination: LatLng & { address: string; details?: string | null };
  customerName?: string | null;
  customerPhone?: string | null;
  notes?: string | null;
  distanceMeters: number;
  durationSeconds?: number | null;
}

/**
 * Domicilios: deliveries from a branch to an address. The route is computed
 * on the map (the browser asks Google for it); the fee is computed here from
 * its distance and the business's pricing, so it is always the business's.
 */
@Injectable()
export class DeliveriesService {
  constructor(
    private readonly repository: DeliveriesRepository,
    private readonly auditService: AuditService,
    private readonly push: PushNotificationsService,
  ) {}

  async getSettings(businessId: string): Promise<DeliverySettings> {
    const row = await this.repository.findSettings(businessId);
    return row
      ? { ...toPricing(row), configured: true, updatedAt: row.updated_at }
      : { ...DEFAULT_PRICING, configured: false, updatedAt: null };
  }

  async saveSettings(
    businessId: string,
    pricing: DeliveryPricing,
    actorUserId: string,
  ): Promise<DeliverySettings> {
    const row = await this.repository.saveSettings(businessId, {
      ...pricing,
      updatedBy: actorUserId,
    });
    await this.auditService.record({
      businessId,
      userId: actorUserId,
      entityType: 'delivery_settings',
      entityId: businessId,
      action: 'UPDATE',
      newValues: { ...pricing },
    });
    return { ...toPricing(row), configured: true, updatedAt: row.updated_at };
  }

  async getBranchLocations(businessId: string): Promise<BranchLocation[]> {
    const rows = await this.repository.findBranchLocations(businessId);
    return rows.map((row) => ({
      branchId: row.branch_id,
      branchName: row.branch_name,
      branchAddress: row.branch_address,
      isActive: row.is_active,
      latitude: row.latitude === null ? null : Number(row.latitude),
      longitude: row.longitude === null ? null : Number(row.longitude),
    }));
  }

  async setBranchLocation(
    businessId: string,
    branchId: string,
    location: LatLng,
    actorUserId: string,
  ): Promise<BranchLocation[]> {
    if (!(await this.repository.branchExists(businessId, branchId))) {
      throw new EntityNotFoundException('Branch', branchId);
    }
    await this.repository.saveBranchLocation(
      businessId,
      branchId,
      location.latitude,
      location.longitude,
      actorUserId,
    );
    await this.auditService.record({
      businessId,
      branchId,
      userId: actorUserId,
      entityType: 'delivery_branch_location',
      entityId: branchId,
      action: 'UPDATE',
      newValues: { ...location },
    });
    return this.getBranchLocations(businessId);
  }

  async getCouriers(businessId: string): Promise<Courier[]> {
    const rows = await this.repository.findCouriers(businessId);
    return rows.map((row) => ({
      id: row.id,
      name: `${row.first_name} ${row.last_name}`.trim(),
      phone: row.phone,
      branchId: row.branch_id,
    }));
  }

  async getLinkableOrders(
    businessId: string,
    search?: string,
  ): Promise<LinkableOrder[]> {
    const rows = await this.repository.findLinkableOrders(
      businessId,
      search,
      MAX_LINKABLE_ORDERS,
    );
    return rows.map((row) => ({
      id: row.id,
      orderNumber: row.order_number,
      orderType: row.order_type,
      status: row.status,
      branchId: row.branch_id,
      deliveryAddress: row.delivery_address,
      totalAmount: Number(row.total_amount),
      customerName: row.customer_name,
      customerPhone: row.customer_phone,
      createdAt: row.created_at,
    }));
  }

  async findAll(
    businessId: string,
    filters: DeliveryFilters,
  ): Promise<Delivery[]> {
    const rows = await this.repository.findAll(businessId, filters, MAX_LISTED);
    return rows.map(toDelivery);
  }

  async findOne(businessId: string, id: string): Promise<Delivery> {
    return toDelivery(await this.getRowOrFail(businessId, id));
  }

  async create(
    businessId: string,
    input: CreateDeliveryInput,
    actorUserId: string,
  ): Promise<Delivery> {
    const settings = await this.repository.findSettings(businessId);
    if (!settings) {
      throw new BusinessRuleException(
        'Configura la tarifa de domicilios antes de crear el primero',
        'DELIVERY_PRICING_NOT_CONFIGURED',
      );
    }
    if (!(await this.repository.branchExists(businessId, input.branchId))) {
      throw new EntityNotFoundException('Branch', input.branchId);
    }
    if (input.orderId) {
      await this.assertOrderLinkable(businessId, input.orderId);
    }
    if (input.courierUserId) {
      await this.assertCourier(businessId, input.courierUserId);
    }

    const pricing = toPricing(settings);
    const { fee } = quoteDelivery(input.distanceMeters, pricing);
    const trackingCode = await this.newTrackingCode();
    const id = await this.repository.create({
      trackingCode,
      businessId,
      branchId: input.branchId,
      orderId: input.orderId ?? null,
      courierUserId: input.courierUserId ?? null,
      status: input.courierUserId ? 'ASSIGNED' : 'PENDING',
      origin: input.origin,
      destination: {
        ...input.destination,
        details: input.destination.details?.trim() || null,
      },
      customerName: input.customerName?.trim() || null,
      customerPhone: input.customerPhone?.trim() || null,
      notes: input.notes?.trim() || null,
      distanceMeters: Math.round(input.distanceMeters),
      durationSeconds:
        input.durationSeconds == null
          ? null
          : Math.round(input.durationSeconds),
      fee,
      pricing,
      createdBy: actorUserId,
    });

    await this.auditService.record({
      businessId,
      branchId: input.branchId,
      userId: actorUserId,
      entityType: 'delivery',
      entityId: id,
      action: 'CREATE',
      newValues: {
        orderId: input.orderId ?? null,
        courierUserId: input.courierUserId ?? null,
        distanceMeters: input.distanceMeters,
        fee,
      },
    });
    const delivery = await this.findOne(businessId, id);
    if (delivery.courier) this.notifyAssigned(delivery.courier.id, delivery);
    return delivery;
  }

  /**
   * Links the delivery to an order of the POS (or, with null, unlinks it),
   * also after it was created: the order is often rung up while the
   * delivery is already on its way.
   */
  async linkOrder(
    businessId: string,
    id: string,
    orderId: string | null,
    actorUserId: string,
  ): Promise<Delivery> {
    const row = await this.getRowOrFail(businessId, id);
    if (row.status === 'CANCELLED') {
      throw new BusinessRuleException(
        'El domicilio está cancelado',
        'DELIVERY_CLOSED',
      );
    }
    if (orderId === row.order_id) {
      return toDelivery(row);
    }
    if (orderId) {
      await this.assertOrderLinkable(businessId, orderId);
    }
    await this.repository.setOrder(businessId, id, orderId);
    await this.auditService.record({
      businessId,
      branchId: row.branch_id,
      userId: actorUserId,
      entityType: 'delivery',
      entityId: id,
      action: orderId ? 'LINK_ORDER' : 'UNLINK_ORDER',
      oldValues: { orderId: row.order_id },
      newValues: { orderId },
    });
    return this.findOne(businessId, id);
  }

  /** Assigns (or, with null, unassigns) the courier. */
  async assignCourier(
    businessId: string,
    id: string,
    courierUserId: string | null,
    actorUserId: string,
  ): Promise<Delivery> {
    const row = await this.getRowOrFail(businessId, id);
    if (row.status === 'DELIVERED' || row.status === 'CANCELLED') {
      throw new BusinessRuleException(
        'El domicilio ya terminó',
        'DELIVERY_CLOSED',
      );
    }
    if (courierUserId === null && row.status === 'IN_TRANSIT') {
      throw new BusinessRuleException(
        'El domicilio va en camino: cambia el domiciliario en vez de quitarlo',
        'DELIVERY_IN_TRANSIT',
      );
    }
    if (courierUserId) {
      await this.assertCourier(businessId, courierUserId);
    }
    await this.repository.setCourier(businessId, id, courierUserId);
    await this.auditService.record({
      businessId,
      branchId: row.branch_id,
      userId: actorUserId,
      entityType: 'delivery',
      entityId: id,
      action: 'ASSIGN_COURIER',
      oldValues: { courierUserId: row.courier_user_id },
      newValues: { courierUserId },
    });
    const delivery = await this.findOne(businessId, id);
    if (courierUserId && courierUserId !== row.courier_user_id) {
      this.notifyAssigned(courierUserId, delivery);
    }
    return delivery;
  }

  async changeStatus(
    businessId: string,
    id: string,
    status: DeliveryStatus,
    actorUserId: string,
  ): Promise<Delivery> {
    const row = await this.getRowOrFail(businessId, id);
    if (!NEXT_STATUSES[row.status].includes(status)) {
      throw new BusinessRuleException(
        `Un domicilio ${row.status} no puede pasar a ${status}`,
        'DELIVERY_INVALID_STATUS',
      );
    }
    await this.repository.setStatus(businessId, id, status);
    await this.auditService.record({
      businessId,
      branchId: row.branch_id,
      userId: actorUserId,
      entityType: 'delivery',
      entityId: id,
      action: 'STATUS_CHANGE',
      oldValues: { status: row.status },
      newValues: { status },
    });
    return this.findOne(businessId, id);
  }

  /** A courier's own deliveries, for their app. */
  async findMine(
    businessId: string,
    courierUserId: string,
    scope: CourierScope,
    from?: Date,
  ): Promise<Delivery[]> {
    const rows = await this.repository.findForCourier(
      businessId,
      courierUserId,
      scope,
      from ?? null,
      MAX_COURIER_LISTED,
    );
    return rows.map(toDelivery);
  }

  async getBalance(
    businessId: string,
    courierUserId: string,
    from: Date,
  ): Promise<CourierBalance> {
    return this.repository.courierBalance(businessId, courierUserId, from);
  }

  /** The courier starts (on the way) or finishes (delivered) one of their own deliveries. */
  async advanceOwn(
    businessId: string,
    courierUserId: string,
    id: string,
    status: DeliveryStatus,
  ): Promise<Delivery> {
    const row = await this.getOwnRowOrFail(businessId, courierUserId, id);
    if (!(COURIER_NEXT[row.status] ?? []).includes(status)) {
      throw new BusinessRuleException(
        `Un domicilio ${row.status} no puede pasar a ${status}`,
        'DELIVERY_INVALID_STATUS',
      );
    }
    await this.repository.setStatus(businessId, id, status);
    await this.auditService.record({
      businessId,
      branchId: row.branch_id,
      userId: courierUserId,
      entityType: 'delivery',
      entityId: id,
      action: 'STATUS_CHANGE',
      oldValues: { status: row.status },
      newValues: { status, by: 'COURIER' },
    });
    return this.findOne(businessId, id);
  }

  /** A delivery assigned to this courier; another's is reported as not found. */
  async getOwnRowOrFail(
    businessId: string,
    courierUserId: string,
    id: string,
  ): Promise<DeliveryRow> {
    const row = await this.repository.findById(businessId, id);
    if (!row || row.courier_user_id !== courierUserId) {
      throw new EntityNotFoundException('Delivery', id);
    }
    return row;
  }

  /** Tells the courier's phone a delivery is theirs (best-effort: never blocks the assignment). */
  private notifyAssigned(courierUserId: string, delivery: Delivery): void {
    void this.push.sendToUser(courierUserId, {
      title: `Nuevo domicilio · ${delivery.trackingCode}`,
      body: [delivery.destination.address, delivery.customerName]
        .filter(Boolean)
        .join(' · '),
      tag: `assigned-${delivery.id}`,
      url: '/domiciliario',
      requireInteraction: true,
    });
  }

  private async newTrackingCode(): Promise<string> {
    for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt++) {
      const code = Array.from(
        { length: CODE_LENGTH },
        () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)],
      ).join('');
      if (!(await this.repository.trackingCodeTaken(code))) {
        return code;
      }
    }
    throw new ConflictException(
      'No se pudo generar el código de seguimiento, intenta de nuevo',
      'DELIVERY_CODE_UNAVAILABLE',
    );
  }

  private async getRowOrFail(
    businessId: string,
    id: string,
  ): Promise<DeliveryRow> {
    const row = await this.repository.findById(businessId, id);
    if (!row) {
      throw new EntityNotFoundException('Delivery', id);
    }
    return row;
  }

  private async assertOrderLinkable(
    businessId: string,
    orderId: string,
  ): Promise<void> {
    const order = await this.repository.findOrder(businessId, orderId);
    if (!order) {
      throw new EntityNotFoundException('Order', orderId);
    }
    if (order.status === 'CANCELLED') {
      throw new BusinessRuleException(
        'El pedido está cancelado',
        'DELIVERY_ORDER_CANCELLED',
      );
    }
    if (await this.repository.orderHasLiveDelivery(orderId)) {
      throw new ConflictException(
        'Ese pedido ya tiene un domicilio',
        'DELIVERY_ORDER_TAKEN',
      );
    }
  }

  private async assertCourier(
    businessId: string,
    userId: string,
  ): Promise<void> {
    if (!(await this.repository.findCourier(businessId, userId))) {
      throw new BusinessRuleException(
        'Ese usuario no es un domiciliario activo',
        'DELIVERY_NOT_A_COURIER',
      );
    }
  }
}
