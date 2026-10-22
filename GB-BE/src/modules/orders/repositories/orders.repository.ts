import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service';
import { getOffset } from '../../../common/pagination/pagination.util';
import { DbClient } from '../../../database/types/database.types';
import {
  DailySalesRow,
  OrderItemRow,
  OrderRow,
  OrderStatus,
  OrderStatusHistoryRow,
  PaymentPolicy,
  SalesSummaryRow,
  TopProductRow,
  TopProductsOrder,
} from '../domain/order.interface';
import {
  CreateOrderData,
  OrderItemComputed,
  OrderQuery,
} from '../domain/order.types';
import { IOrdersRepository } from './orders.repository.interface';

const SELECT_COLUMNS = `id, business_id, branch_id, customer_id, customer_name, created_by, order_number::text AS order_number,
  order_type, status, payment_status, payment_policy, table_number, delivery_address, delivery_instructions,
  subtotal, discount_amount, discount_percent, discount_id, discount_source, discount_label,
  tax_amount, delivery_fee, total_amount, notes,
  confirmed_at, prepared_at, delivered_at, cancelled_at, created_at, updated_at`;

const ITEM_COLUMNS = `id, order_id, product_id, product_name_snapshot, product_description_snapshot, quantity, unit_price,
  unit_cost_snapshot, discount_amount, total_price, notes, option_selections, created_at`;

const HISTORY_COLUMNS = `id, order_id, previous_status, new_status, changed_by, notes, created_at`;

interface CountRow {
  count: string;
}

/**
 * What counts as a sale, for every sales figure: an order that is fully paid
 * and was not cancelled. It is a sale from the moment its last payment came
 * in, whether or not it has been delivered yet — an order paid at the counter
 * before it is served is already sold, and one delivered on credit is not.
 * A part payment is not a sale until the order is paid in full.
 */
const SALES = `orders o
       JOIN LATERAL (
         SELECT MAX(p.paid_at) AS sold_at FROM payments p
         WHERE p.order_id = o.id AND p.status = 'PAID'
       ) sale ON true`;
const IS_SALE = `o.payment_status = 'PAID' AND o.status <> 'CANCELLED'`;

/** The two ways to rank products, spelled out here so the ORDER BY never comes from outside. */
const TOP_PRODUCTS_ORDER: Record<TopProductsOrder, string> = {
  revenue: 'SUM(oi.total_price) DESC, SUM(oi.quantity) DESC',
  quantity: 'SUM(oi.quantity) DESC, SUM(oi.total_price) DESC',
};

@Injectable()
export class OrdersRepository implements IOrdersRepository {
  constructor(private readonly db: DatabaseService) {}

  async create(
    data: CreateOrderData,
    createdBy: string | undefined,
    timezone: string = 'America/Bogota',
    paymentPolicy: PaymentPolicy = PaymentPolicy.PAY_AT_END,
    client?: DbClient,
  ): Promise<OrderRow> {
    const result = await this.db.query<OrderRow>(
      `WITH cur_date AS (
         SELECT (now() AT TIME ZONE $12)::date AS d
       ),
       -- Each branch numbers its own day.
       counter AS (
         INSERT INTO daily_order_counters (business_id, branch_id, order_date, last_number)
         SELECT $1, $2, d, 1 FROM cur_date
         ON CONFLICT (business_id, branch_id, order_date)
         DO UPDATE SET last_number = daily_order_counters.last_number + 1
         RETURNING last_number, order_date
       )
       INSERT INTO orders (business_id, branch_id, customer_id, created_by, order_type, table_number,
         delivery_address, delivery_instructions, discount_amount, delivery_fee, notes, order_number, customer_name,
         payment_policy, order_date)
       SELECT $1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9::numeric, 0), COALESCE($10::numeric, 0), $11,
         -- At least two digits ("-07"); lpad would cut a 100th order to "-10", a duplicate.
         to_char(counter.order_date, 'MMDD') || '-' || lpad(counter.last_number::text, GREATEST(2, length(counter.last_number::text)), '0'), $13, $14,
         counter.order_date
       FROM counter
       RETURNING ${SELECT_COLUMNS}`,
      [
        data.businessId,
        data.branchId,
        data.customerId ?? null,
        createdBy ?? null,
        data.orderType,
        data.tableNumber ?? null,
        data.deliveryAddress ?? null,
        data.deliveryInstructions ?? null,
        data.discountAmount ?? null,
        data.deliveryFee ?? null,
        data.notes ?? null,
        timezone,
        data.customerName ?? null,
        paymentPolicy,
      ],
      client,
    );
    return result.rows[0];
  }

  async findById(
    id: string,
    businessId: string,
    client?: DbClient,
  ): Promise<OrderRow | null> {
    const result = await this.db.query<OrderRow>(
      `SELECT ${SELECT_COLUMNS} FROM orders WHERE id = $1 AND business_id = $2`,
      [id, businessId],
      client,
    );
    return result.rows[0] ?? null;
  }

  async findAll(
    query: OrderQuery,
  ): Promise<{ rows: OrderRow[]; total: number }> {
    const conditions: string[] = ['business_id = $1'];
    const params: unknown[] = [query.businessId];

    if (query.branchId) {
      params.push(query.branchId);
      conditions.push(`branch_id = $${params.length}`);
    }
    if (query.status) {
      params.push(query.status);
      conditions.push(`status = $${params.length}`);
    }
    if (query.orderType) {
      params.push(query.orderType);
      conditions.push(`order_type = $${params.length}`);
    }
    if (query.customerId) {
      params.push(query.customerId);
      conditions.push(`customer_id = $${params.length}`);
    }
    if (query.createdBy) {
      params.push(query.createdBy);
      conditions.push(`created_by = $${params.length}`);
    }
    if (query.dateFrom) {
      params.push(query.dateFrom);
      conditions.push(`created_at >= $${params.length}`);
    }
    if (query.dateTo) {
      params.push(query.dateTo);
      conditions.push(`created_at <= $${params.length}`);
    }

    const whereClause = conditions.join(' AND ');

    const countResult = await this.db.query<CountRow>(
      `SELECT COUNT(*)::text AS count FROM orders WHERE ${whereClause}`,
      params,
    );
    const total = parseInt(countResult.rows[0]?.count ?? '0', 10);

    const dataParams = [
      ...params,
      query.limit,
      getOffset(query.page, query.limit),
    ];
    const rowsResult = await this.db.query<OrderRow>(
      `SELECT ${SELECT_COLUMNS}
       FROM orders
       WHERE ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
      dataParams,
    );

    return { rows: rowsResult.rows, total };
  }

  async findActiveForKitchen(
    businessId: string,
    branchId?: string,
  ): Promise<OrderRow[]> {
    const params: unknown[] = [businessId];
    let branchCondition = '';
    if (branchId) {
      params.push(branchId);
      branchCondition = ` AND branch_id = $${params.length}`;
    }
    const result = await this.db.query<OrderRow>(
      `SELECT ${SELECT_COLUMNS} FROM orders
       WHERE business_id = $1 AND status IN ('CONFIRMED', 'PREPARING')${branchCondition}
       ORDER BY created_at ASC`,
      params,
    );
    return result.rows;
  }

  async findActiveByTable(
    businessId: string,
    branchId: string,
    tableNumber: string,
  ): Promise<OrderRow | null> {
    const result = await this.db.query<OrderRow>(
      `SELECT ${SELECT_COLUMNS} FROM orders
       WHERE business_id = $1 AND branch_id = $2 AND table_number = $3
         AND order_type = 'DINE_IN' AND status NOT IN ('DELIVERED', 'CANCELLED')
       ORDER BY created_at DESC
       LIMIT 1`,
      [businessId, branchId, tableNumber],
    );
    return result.rows[0] ?? null;
  }

  async findBacklog(
    businessId: string,
    timezone: string,
    branchId?: string,
  ): Promise<OrderRow[]> {
    const params: unknown[] = [businessId, timezone];
    let branchCondition = '';
    if (branchId) {
      params.push(branchId);
      branchCondition = ` AND branch_id = $${params.length}`;
    }
    const result = await this.db.query<OrderRow>(
      `SELECT ${SELECT_COLUMNS} FROM orders
       WHERE business_id = $1
         AND status IN ('PENDING', 'CONFIRMED', 'PREPARING', 'READY')
         AND (created_at AT TIME ZONE $2)::date < (now() AT TIME ZONE $2)::date${branchCondition}
       ORDER BY created_at ASC`,
      params,
    );
    return result.rows;
  }

  async addItems(
    orderId: string,
    items: OrderItemComputed[],
    client?: DbClient,
  ): Promise<void> {
    for (const item of items) {
      await this.db.query(
        `INSERT INTO order_items
           (order_id, product_id, product_name_snapshot, product_description_snapshot, quantity, unit_price, unit_cost_snapshot, discount_amount, total_price, notes, option_selections)
         VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8::numeric, 0), $9, $10, $11::jsonb)`,
        [
          orderId,
          item.productId,
          item.productNameSnapshot,
          item.productDescriptionSnapshot ?? null,
          item.quantity,
          item.unitPrice,
          item.unitCostSnapshot,
          item.discountAmount ?? null,
          item.totalPrice,
          item.notes ?? null,
          JSON.stringify(item.optionSelections),
        ],
        client,
      );
    }
  }

  async replaceItems(
    orderId: string,
    items: OrderItemComputed[],
    client?: DbClient,
  ): Promise<void> {
    await this.db.query(
      `DELETE FROM order_items WHERE order_id = $1`,
      [orderId],
      client,
    );
    await this.addItems(orderId, items, client);
  }

  async findItems(orderId: string, client?: DbClient): Promise<OrderItemRow[]> {
    const result = await this.db.query<OrderItemRow>(
      `SELECT ${ITEM_COLUMNS} FROM order_items WHERE order_id = $1 ORDER BY created_at`,
      [orderId],
      client,
    );
    return result.rows;
  }

  async updateTotals(
    orderId: string,
    subtotal: number,
    discountAmount: number,
    taxAmount: number,
    deliveryFee: number,
    totalAmount: number,
    client?: DbClient,
  ): Promise<void> {
    await this.db.query(
      `UPDATE orders
       SET subtotal = $2, discount_amount = $3, tax_amount = $4, delivery_fee = $5, total_amount = $6
       WHERE id = $1`,
      [orderId, subtotal, discountAmount, taxAmount, deliveryFee, totalAmount],
      client,
    );
  }

  async setDiscount(
    orderId: string,
    discount: {
      percent: number;
      discountId: string | null;
      source: string;
      label: string;
    } | null,
    client?: DbClient,
  ): Promise<void> {
    await this.db.query(
      `UPDATE orders
       SET discount_percent = $2, discount_id = $3, discount_source = $4, discount_label = $5
       WHERE id = $1`,
      [
        orderId,
        discount?.percent ?? null,
        discount?.discountId ?? null,
        discount?.source ?? null,
        discount?.label ?? null,
      ],
      client,
    );
  }

  async setStatus(
    id: string,
    businessId: string,
    status: OrderStatus,
    timestampColumn: string | null,
    client?: DbClient,
  ): Promise<OrderRow | null> {
    const timestampSet = timestampColumn ? `, ${timestampColumn} = now()` : '';
    const result = await this.db.query<OrderRow>(
      `UPDATE orders SET status = $3${timestampSet}
       WHERE id = $1 AND business_id = $2
       RETURNING ${SELECT_COLUMNS}`,
      [id, businessId, status],
      client,
    );
    return result.rows[0] ?? null;
  }

  async updatePaymentStatus(
    id: string,
    paymentStatus: string,
    client?: DbClient,
  ): Promise<void> {
    await this.db.query(
      `UPDATE orders SET payment_status = $2 WHERE id = $1`,
      [id, paymentStatus],
      client,
    );
  }

  /**
   * Queried directly against `payments` (not via PaymentsModule) to avoid a circular
   * module dependency — PaymentsModule already imports OrdersModule.
   */
  async getTotalPaid(orderId: string, client?: DbClient): Promise<number> {
    const result = await this.db.query<{ total: string | null }>(
      `SELECT SUM(amount)::text AS total FROM payments WHERE order_id = $1`,
      [orderId],
      client,
    );
    return parseFloat(result.rows[0]?.total ?? '0');
  }

  async addStatusHistory(
    orderId: string,
    previousStatus: OrderStatus | null,
    newStatus: OrderStatus,
    changedBy: string | undefined,
    notes: string | undefined,
    client?: DbClient,
  ): Promise<OrderStatusHistoryRow> {
    const result = await this.db.query<OrderStatusHistoryRow>(
      `INSERT INTO order_status_history (order_id, previous_status, new_status, changed_by, notes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${HISTORY_COLUMNS}`,
      [orderId, previousStatus, newStatus, changedBy ?? null, notes ?? null],
      client,
    );
    return result.rows[0];
  }

  async findStatusHistory(orderId: string): Promise<OrderStatusHistoryRow[]> {
    const result = await this.db.query<OrderStatusHistoryRow>(
      `SELECT ${HISTORY_COLUMNS} FROM order_status_history WHERE order_id = $1 ORDER BY created_at`,
      [orderId],
    );
    return result.rows;
  }

  async getActiveCount(businessId: string, branchId?: string): Promise<number> {
    const params: unknown[] = [businessId];
    let branchCondition = '';
    if (branchId) {
      params.push(branchId);
      branchCondition = ` AND branch_id = $${params.length}`;
    }
    const result = await this.db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM orders
       WHERE business_id = $1 AND status IN ('PENDING', 'CONFIRMED', 'PREPARING', 'READY')${branchCondition}`,
      params,
    );
    return parseInt(result.rows[0]?.count ?? '0', 10);
  }

  async getSalesSummary(
    businessId: string,
    branchId: string | undefined,
    dateFrom: string,
    dateTo: string,
  ): Promise<SalesSummaryRow> {
    const params: unknown[] = [businessId, dateFrom, dateTo];
    let branchCondition = '';
    if (branchId) {
      params.push(branchId);
      branchCondition = ` AND o.branch_id = $${params.length}`;
    }
    const result = await this.db.query<SalesSummaryRow>(
      `SELECT COUNT(*)::text AS order_count, SUM(o.total_amount)::text AS total_amount
       FROM ${SALES}
       WHERE o.business_id = $1 AND ${IS_SALE}
         AND sale.sold_at >= $2 AND sale.sold_at <= $3${branchCondition}`,
      params,
    );
    return result.rows[0];
  }

  async getSalesByDay(
    businessId: string,
    branchId: string | undefined,
    dateFrom: string,
    dateTo: string,
    timezone: string,
  ): Promise<DailySalesRow[]> {
    const params: unknown[] = [businessId, dateFrom, dateTo, timezone];
    let branchCondition = '';
    if (branchId) {
      params.push(branchId);
      branchCondition = ` AND o.branch_id = $${params.length}`;
    }
    // The day is taken in the business's timezone, not the database's: a sale
    // paid at 11:30 PM belongs to that day wherever the server runs.
    const result = await this.db.query<DailySalesRow>(
      `SELECT (sale.sold_at AT TIME ZONE $4)::date::text AS date, COUNT(*)::text AS order_count, SUM(o.total_amount)::text AS total_amount
       FROM ${SALES}
       WHERE o.business_id = $1 AND ${IS_SALE}
         AND sale.sold_at >= $2 AND sale.sold_at <= $3${branchCondition}
       GROUP BY (sale.sold_at AT TIME ZONE $4)::date
       ORDER BY (sale.sold_at AT TIME ZONE $4)::date`,
      params,
    );
    return result.rows;
  }

  async getTopProducts(
    businessId: string,
    branchId: string | undefined,
    dateFrom: string,
    dateTo: string,
    limit: number,
    orderBy: TopProductsOrder = 'revenue',
  ): Promise<TopProductRow[]> {
    const params: unknown[] = [businessId, dateFrom, dateTo];
    let branchCondition = '';
    if (branchId) {
      params.push(branchId);
      branchCondition = ` AND o.branch_id = $${params.length}`;
    }
    params.push(limit);
    const result = await this.db.query<TopProductRow>(
      `SELECT oi.product_id, oi.product_name_snapshot AS product_name,
              SUM(oi.quantity)::text AS quantity_sold, SUM(oi.total_price)::text AS revenue
       FROM ${SALES}
       JOIN order_items oi ON oi.order_id = o.id
       WHERE o.business_id = $1 AND ${IS_SALE}
         AND sale.sold_at >= $2 AND sale.sold_at <= $3${branchCondition}
       GROUP BY oi.product_id, oi.product_name_snapshot
       ORDER BY ${TOP_PRODUCTS_ORDER[orderBy]}, oi.product_name_snapshot
       LIMIT $${params.length}`,
      params,
    );
    return result.rows;
  }

  /**
   * What customers ordered in a range, paid or not: every order not
   * cancelled, by when it was taken. The products by units, the most ordered
   * first, and how many orders there were.
   */
  async getMostOrdered(
    businessId: string,
    branchId: string | undefined,
    dateFrom: string,
    dateTo: string,
    limit: number,
  ): Promise<{ order_count: string; product_ids: string[] | null }> {
    const params: unknown[] = [businessId, dateFrom, dateTo];
    let branchCondition = '';
    if (branchId) {
      params.push(branchId);
      branchCondition = ` AND o.branch_id = $${params.length}`;
    }
    params.push(limit);
    const result = await this.db.query<{
      order_count: string;
      product_ids: string[] | null;
    }>(
      `WITH taken AS (
         SELECT o.id FROM orders o
         WHERE o.business_id = $1 AND o.status <> 'CANCELLED'
           AND o.created_at >= $2 AND o.created_at <= $3${branchCondition}
       ),
       ranked AS (
         SELECT oi.product_id, SUM(oi.quantity) AS units
         FROM taken JOIN order_items oi ON oi.order_id = taken.id
         WHERE oi.product_id IS NOT NULL
         GROUP BY oi.product_id
         ORDER BY units DESC, oi.product_id
         LIMIT $${params.length}
       )
       SELECT (SELECT COUNT(*) FROM taken)::text AS order_count,
              (SELECT array_agg(product_id ORDER BY units DESC, product_id) FROM ranked) AS product_ids`,
      params,
    );
    return result.rows[0];
  }
}
