import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service';

export interface BusinessOverviewRow {
  id: string;
  name: string;
  legal_name: string | null;
  tax_id: string | null;
  email: string | null;
  phone: string | null;
  currency: string;
  timezone: string;
  is_active: boolean;
  created_at: Date;
  has_logo: boolean;
  branch_count: number;
  active_branch_count: number;
  user_count: number;
  last_login_at: Date | null;
  tura_links: number;
  e_configured: boolean;
  e_environment: string | null;
  e_issued: number;
  e_failed: number;
  e_last_issued_at: Date | null;
  orders_30d: number;
  sales_30d: string;
  last_order_at: Date | null;
}

export interface BusinessActivityRow {
  products: number;
  active_products: number;
  inventory_items: number;
  customers: number;
  orders_total: number;
  orders_today: number;
  sales_today: string;
  orders_7d: number;
  sales_7d: string;
}

export interface DailySalesRow {
  date: string;
  orders: number;
  sales: string;
}

/**
 * A sale is what Analytics counts (see OrdersRepository): a fully paid order
 * that was not cancelled, dated by its last payment. `$since` bounds it.
 */
const SALES_SINCE = (since: string) => `
  SELECT o.business_id, o.total_amount, sale.sold_at
  FROM orders o
  JOIN LATERAL (
    SELECT MAX(p.paid_at) AS sold_at FROM payments p
    WHERE p.order_id = o.id AND p.status = 'PAID'
  ) sale ON true
  WHERE o.payment_status = 'PAID' AND o.status <> 'CANCELLED' AND sale.sold_at >= ${since}`;

/**
 * Every business at a glance for the Golden Bites team: its size (branches,
 * users), its recent activity and how far along it is with TURA and Factus.
 * Read-only, one query for the whole platform.
 */
@Injectable()
export class PlatformOverviewRepository {
  constructor(private readonly db: DatabaseService) {}

  /** One row per business (all of them, or the one given), the platform's own internal business left out. */
  async businesses(businessId?: string): Promise<BusinessOverviewRow[]> {
    const params: unknown[] = [];
    let filter = '';
    if (businessId) {
      params.push(businessId);
      filter = ` AND b.id = $${params.length}`;
    }
    const result = await this.db.query<BusinessOverviewRow>(
      `WITH sales AS (
         SELECT business_id, COUNT(*)::int AS orders, COALESCE(SUM(total_amount), 0) AS total
         FROM (${SALES_SINCE("now() - interval '30 days'")}) s
         GROUP BY business_id
       )
       SELECT b.id, b.name, b.legal_name, b.tax_id, b.email, b.phone, b.currency, b.timezone,
              b.is_active, b.created_at, (b.logo_path IS NOT NULL) AS has_logo,
              (SELECT COUNT(*)::int FROM branches x WHERE x.business_id = b.id) AS branch_count,
              (SELECT COUNT(*)::int FROM branches x WHERE x.business_id = b.id AND x.is_active) AS active_branch_count,
              (SELECT COUNT(*)::int FROM users u
                WHERE u.business_id = b.id AND u.deleted_at IS NULL AND u.status = 'ACTIVE') AS user_count,
              (SELECT MAX(u.last_login_at) FROM users u WHERE u.business_id = b.id) AS last_login_at,
              (SELECT COUNT(*)::int FROM tura_links t
                WHERE t.business_id = b.id AND t.revoked_at IS NULL) AS tura_links,
              (st.client_id IS NOT NULL) AS e_configured,
              st.environment AS e_environment,
              (SELECT COUNT(*)::int FROM electronic_invoices e
                WHERE e.business_id = b.id AND e.status = 'ISSUED') AS e_issued,
              (SELECT COUNT(*)::int FROM electronic_invoices e
                WHERE e.business_id = b.id AND e.status = 'FAILED') AS e_failed,
              (SELECT MAX(e.issued_at) FROM electronic_invoices e WHERE e.business_id = b.id) AS e_last_issued_at,
              COALESCE(sa.orders, 0) AS orders_30d,
              COALESCE(sa.total, 0)::text AS sales_30d,
              (SELECT MAX(o.created_at) FROM orders o WHERE o.business_id = b.id) AS last_order_at
       FROM businesses b
       LEFT JOIN e_invoicing_settings st ON st.business_id = b.id
       LEFT JOIN sales sa ON sa.business_id = b.id
       WHERE NOT b.is_internal${filter}
       ORDER BY b.created_at`,
      params,
    );
    return result.rows;
  }

  /** What a business holds and how much it sold lately; "today" is the business's own day. */
  async activity(
    businessId: string,
    timezone: string,
  ): Promise<BusinessActivityRow> {
    const today = `(date_trunc('day', now() AT TIME ZONE $2) AT TIME ZONE $2)`;
    const result = await this.db.query<BusinessActivityRow>(
      `WITH sales AS (${SALES_SINCE("now() - interval '7 days'")} AND o.business_id = $1)
       SELECT
         (SELECT COUNT(*)::int FROM products p WHERE p.business_id = $1 AND p.deleted_at IS NULL) AS products,
         (SELECT COUNT(*)::int FROM products p
           WHERE p.business_id = $1 AND p.deleted_at IS NULL AND p.is_active) AS active_products,
         (SELECT COUNT(*)::int FROM inventory_items i
           WHERE i.business_id = $1 AND i.deleted_at IS NULL) AS inventory_items,
         (SELECT COUNT(*)::int FROM customers c WHERE c.business_id = $1 AND c.deleted_at IS NULL) AS customers,
         (SELECT COUNT(*)::int FROM orders o WHERE o.business_id = $1) AS orders_total,
         (SELECT COUNT(*)::int FROM sales WHERE sold_at >= ${today}) AS orders_today,
         (SELECT COALESCE(SUM(total_amount), 0)::text FROM sales WHERE sold_at >= ${today}) AS sales_today,
         (SELECT COUNT(*)::int FROM sales) AS orders_7d,
         (SELECT COALESCE(SUM(total_amount), 0)::text FROM sales) AS sales_7d`,
      [businessId, timezone],
    );
    return result.rows[0];
  }

  /** Sales of each of the last 30 days that had any, by the business's calendar. */
  async dailySales(
    businessId: string,
    timezone: string,
  ): Promise<DailySalesRow[]> {
    const result = await this.db.query<DailySalesRow>(
      `SELECT to_char(sold_at AT TIME ZONE $2, 'YYYY-MM-DD') AS date,
              COUNT(*)::int AS orders, COALESCE(SUM(total_amount), 0)::text AS sales
       FROM (${SALES_SINCE("now() - interval '30 days'")} AND o.business_id = $1) s
       GROUP BY 1 ORDER BY 1`,
      [businessId, timezone],
    );
    return result.rows;
  }
}
