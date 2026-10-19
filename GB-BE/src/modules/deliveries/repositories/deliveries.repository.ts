import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service';
import {
  BranchLocationRow,
  COURIER_ROLE,
  CourierBalance,
  CourierRow,
  CourierScope,
  CreateDeliveryData,
  DeliveryFilters,
  DeliveryRow,
  DeliverySettingsRow,
  DeliveryStatus,
  LinkableOrderRow,
  SaveSettingsData,
} from '../domain/delivery.interface';

const SETTINGS_COLUMNS = `business_id, base_fee, price_per_unit, unit, unit_size, billing_mode, minimum_fee, rounding_step, updated_at`;

/** A delivery with the names it is shown with. */
const DELIVERY_SELECT = `
  SELECT d.id, d.business_id, d.branch_id, b.name AS branch_name,
         d.order_id, o.order_number::text AS order_number,
         d.courier_user_id, u.first_name AS courier_first_name, u.last_name AS courier_last_name,
         d.status, d.tracking_code, d.origin_latitude, d.origin_longitude,
         d.destination_address, d.destination_details, d.destination_latitude, d.destination_longitude,
         d.customer_name, d.customer_phone, d.notes,
         d.distance_meters, d.duration_seconds, d.fee, d.pricing, d.created_by,
         d.assigned_at, d.picked_up_at, d.delivered_at, d.cancelled_at, d.created_at, d.updated_at
  FROM deliveries d
  JOIN branches b ON b.id = d.branch_id
  LEFT JOIN orders o ON o.id = d.order_id
  LEFT JOIN users u ON u.id = d.courier_user_id`;

@Injectable()
export class DeliveriesRepository {
  constructor(private readonly db: DatabaseService) {}

  async findSettings(businessId: string): Promise<DeliverySettingsRow | null> {
    const result = await this.db.query<DeliverySettingsRow>(
      `SELECT ${SETTINGS_COLUMNS} FROM delivery_settings WHERE business_id = $1`,
      [businessId],
    );
    return result.rows[0] ?? null;
  }

  async saveSettings(
    businessId: string,
    data: SaveSettingsData,
  ): Promise<DeliverySettingsRow> {
    const result = await this.db.query<DeliverySettingsRow>(
      `INSERT INTO delivery_settings
         (business_id, base_fee, price_per_unit, unit, unit_size, billing_mode, minimum_fee, rounding_step, updated_by, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
       ON CONFLICT (business_id) DO UPDATE SET
         base_fee = EXCLUDED.base_fee,
         price_per_unit = EXCLUDED.price_per_unit,
         unit = EXCLUDED.unit,
         unit_size = EXCLUDED.unit_size,
         billing_mode = EXCLUDED.billing_mode,
         minimum_fee = EXCLUDED.minimum_fee,
         rounding_step = EXCLUDED.rounding_step,
         updated_by = EXCLUDED.updated_by,
         updated_at = now()
       RETURNING ${SETTINGS_COLUMNS}`,
      [
        businessId,
        data.baseFee,
        data.pricePerUnit,
        data.unit,
        data.unitSize,
        data.billingMode,
        data.minimumFee,
        data.roundingStep,
        data.updatedBy,
      ],
    );
    return result.rows[0];
  }

  /** Every branch of the business, with its location when it has one. */
  async findBranchLocations(businessId: string): Promise<BranchLocationRow[]> {
    const result = await this.db.query<BranchLocationRow>(
      `SELECT b.id AS branch_id, b.name AS branch_name, b.address AS branch_address, b.is_active,
              l.latitude, l.longitude
       FROM branches b
       LEFT JOIN delivery_branch_locations l ON l.branch_id = b.id
       WHERE b.business_id = $1
       ORDER BY b.created_at`,
      [businessId],
    );
    return result.rows;
  }

  async branchExists(businessId: string, branchId: string): Promise<boolean> {
    const result = await this.db.query(
      `SELECT 1 FROM branches WHERE id = $1 AND business_id = $2`,
      [branchId, businessId],
    );
    return result.rowCount > 0;
  }

  async saveBranchLocation(
    businessId: string,
    branchId: string,
    latitude: number,
    longitude: number,
    updatedBy: string,
  ): Promise<void> {
    await this.db.query(
      `INSERT INTO delivery_branch_locations (branch_id, business_id, latitude, longitude, updated_by, updated_at)
       VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (branch_id) DO UPDATE SET
         latitude = EXCLUDED.latitude,
         longitude = EXCLUDED.longitude,
         updated_by = EXCLUDED.updated_by,
         updated_at = now()`,
      [branchId, businessId, latitude, longitude, updatedBy],
    );
  }

  /** Active users of the business with the courier role. */
  async findCouriers(businessId: string): Promise<CourierRow[]> {
    const result = await this.db.query<CourierRow>(
      `SELECT u.id, u.first_name, u.last_name, u.phone, u.branch_id
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE u.business_id = $1 AND r.name = $2
         AND u.status = 'ACTIVE' AND u.deleted_at IS NULL
       ORDER BY u.first_name, u.last_name`,
      [businessId, COURIER_ROLE],
    );
    return result.rows;
  }

  async findCourier(
    businessId: string,
    userId: string,
  ): Promise<CourierRow | null> {
    const couriers = await this.findCouriers(businessId);
    return couriers.find((courier) => courier.id === userId) ?? null;
  }

  /**
   * Recent orders a delivery can be linked to: not cancelled, without a live
   * delivery, newest first. Delivery orders first, as they are the usual case.
   */
  async findLinkableOrders(
    businessId: string,
    search: string | undefined,
    limit: number,
  ): Promise<LinkableOrderRow[]> {
    const result = await this.db.query<LinkableOrderRow>(
      `SELECT o.id, o.order_number::text AS order_number, o.order_type, o.status, o.branch_id,
              o.delivery_address, o.total_amount,
              NULLIF(trim(concat_ws(' ', c.first_name, c.last_name)), '') AS customer_name,
              c.phone AS customer_phone, o.created_at
       FROM orders o
       LEFT JOIN customers c ON c.id = o.customer_id
       WHERE o.business_id = $1
         AND o.status <> 'CANCELLED'
         AND o.created_at > now() - interval '3 days'
         AND NOT EXISTS (
           SELECT 1 FROM deliveries d WHERE d.order_id = o.id AND d.status <> 'CANCELLED'
         )
         AND ($2::text IS NULL OR o.order_number::text LIKE '%' || $2 || '%'
              OR o.delivery_address ILIKE '%' || $2 || '%'
              OR concat_ws(' ', c.first_name, c.last_name) ILIKE '%' || $2 || '%')
       ORDER BY (o.order_type = 'DELIVERY') DESC, o.created_at DESC
       LIMIT $3`,
      [businessId, search?.trim() || null, limit],
    );
    return result.rows;
  }

  async findOrder(
    businessId: string,
    orderId: string,
  ): Promise<{ id: string; status: string } | null> {
    const result = await this.db.query<{ id: string; status: string }>(
      `SELECT id, status FROM orders WHERE id = $1 AND business_id = $2`,
      [orderId, businessId],
    );
    return result.rows[0] ?? null;
  }

  async setOrder(
    businessId: string,
    id: string,
    orderId: string | null,
  ): Promise<void> {
    await this.db.query(
      `UPDATE deliveries SET order_id = $3, updated_at = now()
       WHERE id = $1 AND business_id = $2`,
      [id, businessId, orderId],
    );
  }

  async orderHasLiveDelivery(orderId: string): Promise<boolean> {
    const result = await this.db.query(
      `SELECT 1 FROM deliveries WHERE order_id = $1 AND status <> 'CANCELLED'`,
      [orderId],
    );
    return result.rowCount > 0;
  }

  async create(data: CreateDeliveryData): Promise<string> {
    const result = await this.db.query<{ id: string }>(
      `INSERT INTO deliveries (
         business_id, branch_id, order_id, courier_user_id, status,
         origin_latitude, origin_longitude,
         destination_address, destination_details, destination_latitude, destination_longitude,
         customer_name, customer_phone, notes,
         distance_meters, duration_seconds, fee, pricing, created_by, tracking_code, assigned_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
                 CASE WHEN $4::uuid IS NULL THEN NULL ELSE now() END)
       RETURNING id`,
      [
        data.businessId,
        data.branchId,
        data.orderId,
        data.courierUserId,
        data.status,
        data.origin.latitude,
        data.origin.longitude,
        data.destination.address,
        data.destination.details,
        data.destination.latitude,
        data.destination.longitude,
        data.customerName,
        data.customerPhone,
        data.notes,
        data.distanceMeters,
        data.durationSeconds,
        data.fee,
        JSON.stringify(data.pricing),
        data.createdBy,
        data.trackingCode,
      ],
    );
    return result.rows[0].id;
  }

  async trackingCodeTaken(code: string): Promise<boolean> {
    const result = await this.db.query(
      `SELECT 1 FROM deliveries WHERE tracking_code = $1`,
      [code],
    );
    return result.rowCount > 0;
  }

  /**
   * A courier's own deliveries: on the way (active), assigned and not yet
   * started (pending), or finished since `from` (history).
   */
  async findForCourier(
    businessId: string,
    courierUserId: string,
    scope: CourierScope,
    from: Date | null,
    limit: number,
  ): Promise<DeliveryRow[]> {
    const statuses: Record<CourierScope, string[]> = {
      active: ['IN_TRANSIT'],
      pending: ['ASSIGNED'],
      history: ['DELIVERED', 'CANCELLED'],
    };
    const result = await this.db.query<DeliveryRow>(
      `${DELIVERY_SELECT}
       WHERE d.business_id = $1 AND d.courier_user_id = $2
         AND d.status = ANY($3::varchar[])
         AND ($4::timestamptz IS NULL OR d.created_at >= $4)
       ORDER BY ${scope === 'history' ? 'd.created_at DESC' : 'COALESCE(d.picked_up_at, d.assigned_at, d.created_at)'}
       LIMIT $5`,
      [businessId, courierUserId, statuses[scope], from, limit],
    );
    return result.rows;
  }

  /** What a courier delivered (and had cancelled) since `from`. */
  async courierBalance(
    businessId: string,
    courierUserId: string,
    from: Date,
  ): Promise<CourierBalance> {
    const result = await this.db.query<{
      delivered: string;
      cancelled: string;
      fees: string;
      distance: string;
    }>(
      `SELECT COUNT(*) FILTER (WHERE status = 'DELIVERED') AS delivered,
              COUNT(*) FILTER (WHERE status = 'CANCELLED') AS cancelled,
              COALESCE(SUM(fee) FILTER (WHERE status = 'DELIVERED'), 0) AS fees,
              COALESCE(SUM(distance_meters) FILTER (WHERE status = 'DELIVERED'), 0) AS distance
       FROM deliveries
       WHERE business_id = $1 AND courier_user_id = $2
         AND COALESCE(delivered_at, cancelled_at, created_at) >= $3`,
      [businessId, courierUserId, from],
    );
    const row = result.rows[0];
    return {
      from,
      delivered: Number(row.delivered),
      cancelled: Number(row.cancelled),
      fees: Number(row.fees),
      distanceMeters: Number(row.distance),
    };
  }

  async findById(businessId: string, id: string): Promise<DeliveryRow | null> {
    const result = await this.db.query<DeliveryRow>(
      `${DELIVERY_SELECT} WHERE d.id = $1 AND d.business_id = $2`,
      [id, businessId],
    );
    return result.rows[0] ?? null;
  }

  async findAll(
    businessId: string,
    filters: DeliveryFilters,
    limit: number,
  ): Promise<DeliveryRow[]> {
    const result = await this.db.query<DeliveryRow>(
      `${DELIVERY_SELECT}
       WHERE d.business_id = $1
         AND ($2::varchar IS NULL OR d.status = $2)
         AND ($3::uuid IS NULL OR d.branch_id = $3)
         AND ($4::uuid IS NULL OR d.courier_user_id = $4)
         AND ($5::timestamptz IS NULL OR d.created_at >= $5)
         AND ($6::timestamptz IS NULL OR d.created_at <= $6)
       ORDER BY d.created_at DESC
       LIMIT $7`,
      [
        businessId,
        filters.status ?? null,
        filters.branchId ?? null,
        filters.courierUserId ?? null,
        filters.from ?? null,
        filters.to ?? null,
        limit,
      ],
    );
    return result.rows;
  }

  /** Sets the courier; a pending delivery becomes assigned and an assigned one without courier goes back to pending. */
  async setCourier(
    businessId: string,
    id: string,
    courierUserId: string | null,
  ): Promise<void> {
    await this.db.query(
      `UPDATE deliveries SET
         courier_user_id = $3,
         status = CASE
           WHEN $3::uuid IS NOT NULL AND status = 'PENDING' THEN 'ASSIGNED'
           WHEN $3::uuid IS NULL AND status = 'ASSIGNED' THEN 'PENDING'
           ELSE status END,
         assigned_at = CASE WHEN $3::uuid IS NULL THEN NULL ELSE now() END,
         updated_at = now()
       WHERE id = $1 AND business_id = $2`,
      [id, businessId, courierUserId],
    );
  }

  async setStatus(
    businessId: string,
    id: string,
    status: DeliveryStatus,
  ): Promise<void> {
    await this.db.query(
      `UPDATE deliveries SET
         status = $3::varchar,
         picked_up_at = CASE WHEN $3::varchar = 'IN_TRANSIT' THEN now() ELSE picked_up_at END,
         delivered_at = CASE WHEN $3::varchar = 'DELIVERED' THEN now() ELSE delivered_at END,
         cancelled_at = CASE WHEN $3::varchar = 'CANCELLED' THEN now() ELSE cancelled_at END,
         updated_at = now()
       WHERE id = $1 AND business_id = $2`,
      [id, businessId, status],
    );
  }
}
