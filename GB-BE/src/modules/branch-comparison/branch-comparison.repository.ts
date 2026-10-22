import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

export interface BranchFiguresRow {
  branch_id: string;
  name: string;
  is_active: boolean;
  order_count: string;
  sales_total: string;
  discount_total: string;
  expense_total: string;
  waste_total: string;
  active_orders: string;
  cash_open: boolean;
}

export interface BranchDailySalesRow {
  branch_id: string;
  date: string;
  sales_total: string;
}

/**
 * A sale is what Analytics counts (see OrdersRepository): a fully paid order
 * that was not cancelled, dated by its last payment.
 */
const SALES = `SELECT o.branch_id, o.total_amount, o.discount_amount, sale.sold_at
  FROM orders o
  JOIN LATERAL (
    SELECT MAX(p.paid_at) AS sold_at FROM payments p
    WHERE p.order_id = o.id AND p.status = 'PAID'
  ) sale ON true
  WHERE o.business_id = $1 AND o.payment_status = 'PAID' AND o.status <> 'CANCELLED'
    AND sale.sold_at >= $2 AND sale.sold_at <= $3`;

@Injectable()
export class BranchComparisonRepository {
  constructor(private readonly db: DatabaseService) {}

  /**
   * One row per branch with its figures for the range. Expenses are by their
   * date in the business's timezone ($4); expenses not tied to a branch are
   * left out, they belong to the whole business.
   */
  async figures(
    businessId: string,
    dateFrom: string,
    dateTo: string,
    timezone: string,
  ): Promise<BranchFiguresRow[]> {
    const result = await this.db.query<BranchFiguresRow>(
      `WITH sales AS (${SALES}),
       sales_by_branch AS (
         SELECT branch_id, COUNT(*) AS order_count, SUM(total_amount) AS sales_total,
                SUM(discount_amount) AS discount_total
         FROM sales GROUP BY branch_id
       ),
       expenses_by_branch AS (
         SELECT branch_id, SUM(amount) AS expense_total
         FROM expenses
         WHERE business_id = $1 AND deleted_at IS NULL AND branch_id IS NOT NULL
           AND expense_date BETWEEN ($2::timestamptz AT TIME ZONE $4)::date
                                AND ($3::timestamptz AT TIME ZONE $4)::date
         GROUP BY branch_id
       ),
       waste_by_branch AS (
         SELECT branch_id, SUM(quantity * COALESCE(unit_cost, 0)) AS waste_total
         FROM waste_records
         WHERE business_id = $1 AND created_at >= $2 AND created_at <= $3
         GROUP BY branch_id
       ),
       active_by_branch AS (
         SELECT branch_id, COUNT(*) AS active_orders
         FROM orders
         WHERE business_id = $1 AND status IN ('PENDING', 'CONFIRMED', 'PREPARING', 'READY')
         GROUP BY branch_id
       )
       SELECT b.id AS branch_id, b.name, b.is_active,
              COALESCE(s.order_count, 0)::text AS order_count,
              COALESCE(s.sales_total, 0)::text AS sales_total,
              COALESCE(s.discount_total, 0)::text AS discount_total,
              COALESCE(e.expense_total, 0)::text AS expense_total,
              COALESCE(w.waste_total, 0)::text AS waste_total,
              COALESCE(a.active_orders, 0)::text AS active_orders,
              EXISTS (
                SELECT 1 FROM cash_sessions cs WHERE cs.branch_id = b.id AND cs.status = 'OPEN'
              ) AS cash_open
       FROM branches b
       LEFT JOIN sales_by_branch s ON s.branch_id = b.id
       LEFT JOIN expenses_by_branch e ON e.branch_id = b.id
       LEFT JOIN waste_by_branch w ON w.branch_id = b.id
       LEFT JOIN active_by_branch a ON a.branch_id = b.id
       WHERE b.business_id = $1
         AND (b.is_active OR s.order_count IS NOT NULL)
       ORDER BY b.created_at, b.id`,
      [businessId, dateFrom, dateTo, timezone],
    );
    return result.rows;
  }

  /** Sales per branch and calendar day (business timezone), for the chart. */
  async dailySales(
    businessId: string,
    dateFrom: string,
    dateTo: string,
    timezone: string,
  ): Promise<BranchDailySalesRow[]> {
    const result = await this.db.query<BranchDailySalesRow>(
      `WITH sales AS (${SALES})
       SELECT branch_id, (sold_at AT TIME ZONE $4)::date::text AS date,
              SUM(total_amount)::text AS sales_total
       FROM sales
       GROUP BY branch_id, (sold_at AT TIME ZONE $4)::date
       ORDER BY 2`,
      [businessId, dateFrom, dateTo, timezone],
    );
    return result.rows;
  }
}
