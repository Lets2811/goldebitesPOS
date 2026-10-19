import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service';
import {
  COURIER_ROLE,
  CourierCaller,
  CourierCallRow,
  CourierLocationRow,
  CourierPosition,
  DeliveryHelpRequestRow,
  DeliveryMessageRow,
  HelpRequester,
  MessageSender,
  PublicOrderItemRow,
  PublicTrackingRow,
  TrackPointRow,
} from '../domain/delivery.interface';

const MESSAGE_SELECT = `
  SELECT m.id, m.delivery_id, m.sender, m.user_id, u.first_name, m.body, m.created_at
  FROM delivery_messages m
  LEFT JOIN users u ON u.id = m.user_id`;

@Injectable()
export class DeliveryTrackingRepository {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Stores where the courier is, and adds the point to the path of every
   * delivery they have on the way. One statement, one round trip: the phone
   * reports every few seconds.
   */
  async saveCourierPosition(
    businessId: string,
    userId: string,
    position: CourierPosition,
  ): Promise<number> {
    const result = await this.db.query<{ points: string }>(
      `WITH saved AS (
         INSERT INTO courier_locations (user_id, business_id, latitude, longitude, accuracy_meters, heading, speed_mps, recorded_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, now())
         ON CONFLICT (user_id) DO UPDATE SET
           business_id = EXCLUDED.business_id,
           latitude = EXCLUDED.latitude,
           longitude = EXCLUDED.longitude,
           accuracy_meters = EXCLUDED.accuracy_meters,
           heading = EXCLUDED.heading,
           speed_mps = EXCLUDED.speed_mps,
           recorded_at = now()
         RETURNING user_id
       ), points AS (
         INSERT INTO delivery_track_points (delivery_id, latitude, longitude)
         SELECT d.id, $3, $4 FROM deliveries d
         WHERE d.business_id = $2 AND d.courier_user_id = $1 AND d.status = 'IN_TRANSIT'
         RETURNING 1
       )
       SELECT (SELECT COUNT(*) FROM points) AS points FROM saved`,
      [
        userId,
        businessId,
        position.latitude,
        position.longitude,
        position.accuracyMeters,
        position.heading,
        position.speedMps,
      ],
    );
    return Number(result.rows[0]?.points ?? 0);
  }

  /** Active couriers of the business and their last reported position, if any. */
  async findCourierLocations(
    businessId: string,
  ): Promise<CourierLocationRow[]> {
    const result = await this.db.query<CourierLocationRow>(
      `SELECT u.id AS user_id, u.first_name, u.last_name,
              l.latitude, l.longitude, l.accuracy_meters, l.recorded_at
       FROM users u
       JOIN roles r ON r.id = u.role_id AND r.name = $2
       LEFT JOIN courier_locations l ON l.user_id = u.id
       WHERE u.business_id = $1 AND u.status = 'ACTIVE' AND u.deleted_at IS NULL
       ORDER BY u.first_name, u.last_name`,
      [businessId, COURIER_ROLE],
    );
    return result.rows;
  }

  /** The path of these deliveries, oldest point first (at most `perDelivery` latest each). */
  async findTrackPoints(
    deliveryIds: string[],
    perDelivery: number,
  ): Promise<TrackPointRow[]> {
    if (deliveryIds.length === 0) return [];
    const result = await this.db.query<TrackPointRow>(
      `SELECT delivery_id, latitude, longitude, recorded_at FROM (
         SELECT delivery_id, latitude, longitude, recorded_at,
                row_number() OVER (PARTITION BY delivery_id ORDER BY recorded_at DESC) AS rn
         FROM delivery_track_points
         WHERE delivery_id = ANY($1::uuid[])
       ) p
       WHERE rn <= $2
       ORDER BY delivery_id, recorded_at`,
      [deliveryIds, perDelivery],
    );
    return result.rows;
  }

  async findPublicByCode(code: string): Promise<PublicTrackingRow | null> {
    const result = await this.db.query<PublicTrackingRow>(
      `SELECT d.id, d.status, bz.name AS business_name, b.name AS branch_name,
              d.origin_latitude, d.origin_longitude,
              d.destination_address, d.destination_latitude, d.destination_longitude,
              d.courier_user_id, u.first_name AS courier_first_name, u.last_name AS courier_last_name,
              d.fee, d.order_id, o.order_number::text AS order_number,
              o.subtotal AS order_subtotal, o.discount_amount AS order_discount, o.tax_amount AS order_tax,
              o.delivery_fee AS order_delivery_fee, o.total_amount AS order_total,
              o.payment_status::text AS order_payment_status,
              l.latitude AS courier_latitude, l.longitude AS courier_longitude, l.recorded_at AS courier_recorded_at,
              d.created_at, d.assigned_at, d.picked_up_at, d.delivered_at, d.cancelled_at,
              EXISTS (
                SELECT 1 FROM delivery_help_requests h
                WHERE h.delivery_id = d.id AND h.requested_by = 'CUSTOMER' AND h.attended_at IS NULL
              ) AS help_pending
       FROM deliveries d
       JOIN businesses bz ON bz.id = d.business_id
       JOIN branches b ON b.id = d.branch_id
       LEFT JOIN users u ON u.id = d.courier_user_id
       LEFT JOIN courier_locations l ON l.user_id = d.courier_user_id
       LEFT JOIN orders o ON o.id = d.order_id
       WHERE d.tracking_code = $1`,
      [code],
    );
    return result.rows[0] ?? null;
  }

  /** Opens a call for attention, or leaves the one already open as it is. */
  async openHelpRequest(
    deliveryId: string,
    requestedBy: HelpRequester,
    reason: string | null,
  ): Promise<void> {
    await this.db.query(
      `INSERT INTO delivery_help_requests (business_id, branch_id, delivery_id, requested_by, reason)
       SELECT business_id, branch_id, id, $2, $3 FROM deliveries WHERE id = $1
       ON CONFLICT (delivery_id, requested_by) WHERE attended_at IS NULL DO NOTHING`,
      [deliveryId, requestedBy, reason],
    );
  }

  async findPendingHelpRequests(
    businessId: string,
  ): Promise<DeliveryHelpRequestRow[]> {
    const result = await this.db.query<DeliveryHelpRequestRow>(
      `SELECT h.id, h.delivery_id, h.branch_id, h.requested_by, h.reason, h.created_at,
              d.tracking_code, d.status, d.destination_address, d.customer_name, d.customer_phone,
              o.order_number::text AS order_number,
              u.first_name AS courier_first_name, u.last_name AS courier_last_name
       FROM delivery_help_requests h
       JOIN deliveries d ON d.id = h.delivery_id
       LEFT JOIN orders o ON o.id = d.order_id
       LEFT JOIN users u ON u.id = d.courier_user_id
       WHERE h.business_id = $1 AND h.attended_at IS NULL
       ORDER BY h.created_at`,
      [businessId],
    );
    return result.rows;
  }

  async attendHelpRequest(
    businessId: string,
    id: string,
    userId: string,
  ): Promise<boolean> {
    const result = await this.db.query(
      `UPDATE delivery_help_requests SET attended_at = now(), attended_by = $3
       WHERE id = $1 AND business_id = $2 AND attended_at IS NULL`,
      [id, businessId, userId],
    );
    return result.rowCount > 0;
  }

  async findPublicOrderItems(orderId: string): Promise<PublicOrderItemRow[]> {
    const result = await this.db.query<PublicOrderItemRow>(
      `SELECT product_name_snapshot, quantity, unit_price, total_price, notes, option_selections
       FROM order_items WHERE order_id = $1
       ORDER BY created_at, id`,
      [orderId],
    );
    return result.rows;
  }

  /**
   * Opens a call to the delivery's courier. A second call from the same side
   * within `minGapSeconds` while the first is not seen is not stacked: it
   * returns false, and no new push goes out.
   */
  async createCourierCall(
    deliveryId: string,
    courierUserId: string,
    calledBy: CourierCaller,
    staffUserId: string | null,
    minGapSeconds: number,
  ): Promise<boolean> {
    const result = await this.db.query(
      `INSERT INTO courier_calls (business_id, delivery_id, courier_user_id, called_by, staff_user_id)
       SELECT d.business_id, d.id, $2::uuid, $3::varchar, $4::uuid FROM deliveries d
       WHERE d.id = $1
         AND NOT EXISTS (
           SELECT 1 FROM courier_calls c
           WHERE c.delivery_id = $1 AND c.called_by = $3::varchar AND c.seen_at IS NULL
             AND c.created_at > now() - make_interval(secs => $5::double precision)
         )`,
      [deliveryId, courierUserId, calledBy, staffUserId, minGapSeconds],
    );
    return result.rowCount > 0;
  }

  async findOpenCourierCalls(
    businessId: string,
    courierUserId: string,
  ): Promise<CourierCallRow[]> {
    const result = await this.db.query<CourierCallRow>(
      `SELECT c.id, c.delivery_id, c.called_by, u.first_name AS staff_first_name, c.created_at,
              d.tracking_code, d.destination_address, d.customer_name
       FROM courier_calls c
       JOIN deliveries d ON d.id = c.delivery_id
       LEFT JOIN users u ON u.id = c.staff_user_id
       WHERE c.business_id = $1 AND c.courier_user_id = $2 AND c.seen_at IS NULL
         AND d.status NOT IN ('DELIVERED', 'CANCELLED')
       ORDER BY c.created_at`,
      [businessId, courierUserId],
    );
    return result.rows;
  }

  /** Marks every open call of that delivery seen (one tap silences them all). */
  async markCourierCallsSeen(
    businessId: string,
    courierUserId: string,
    deliveryId: string,
  ): Promise<void> {
    await this.db.query(
      `UPDATE courier_calls SET seen_at = now()
       WHERE business_id = $1 AND courier_user_id = $2 AND delivery_id = $3 AND seen_at IS NULL`,
      [businessId, courierUserId, deliveryId],
    );
  }

  async findMessages(
    deliveryId: string,
    after: Date | null,
    limit: number,
  ): Promise<DeliveryMessageRow[]> {
    const result = await this.db.query<DeliveryMessageRow>(
      `${MESSAGE_SELECT}
       WHERE m.delivery_id = $1 AND ($2::timestamptz IS NULL OR m.created_at > $2)
       ORDER BY m.created_at
       LIMIT $3`,
      [deliveryId, after, limit],
    );
    return result.rows;
  }

  async insertMessage(
    deliveryId: string,
    sender: MessageSender,
    userId: string | null,
    body: string,
  ): Promise<DeliveryMessageRow> {
    const result = await this.db.query<{ id: string }>(
      `INSERT INTO delivery_messages (delivery_id, sender, user_id, body)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [deliveryId, sender, userId, body],
    );
    const row = await this.db.query<DeliveryMessageRow>(
      `${MESSAGE_SELECT} WHERE m.id = $1`,
      [result.rows[0].id],
    );
    return row.rows[0];
  }
}
