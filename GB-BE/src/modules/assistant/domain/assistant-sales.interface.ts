import { TopProductsOrder } from '../../orders/domain/order.interface';

export type SalesGroupBy = 'day' | 'week' | 'month';

/** The longest range one request may cover, and the longest that may be broken down day by day. */
export const MAX_RANGE_DAYS = 366;
export const MAX_DAILY_RANGE_DAYS = 31;

export interface AssistantSalesQuery {
  businessId: string;
  /** First and last calendar day of the range, both included, as the business lives them (YYYY-MM-DD). */
  dateFrom: string;
  dateTo: string;
  /** A branch named by the user. Ignored by a business with a single branch. */
  branchName?: string;
  groupBy?: SalesGroupBy;
  includeTopProducts: boolean;
  topProductsLimit: number;
  topProductsOrder: TopProductsOrder;
}

export interface SalesFigures {
  /** Sum of the totals of the sales. */
  totalSales: number;
  /** How many sales: orders paid in full and not cancelled. */
  orderCount: number;
}

export interface AssistantSalesResult {
  period: {
    from: string;
    to: string;
    /** The timezone the days were cut in: the business's own. */
    timezone: string;
  };
  /** Whose sales these are: one branch, or every branch of the business. */
  scope: {
    /** The branch the figures are limited to; null when they cover the whole business. */
    branch: string | null;
    /** The business's active branches, listed only when there is more than one to choose from. */
    branches?: string[];
  };
  summary: SalesFigures & {
    /** totalSales / orderCount; 0 when there were no sales. */
    averageTicket: number;
  };
  /** Present when a grouping was asked for. Periods without sales are left out. */
  breakdown?: {
    groupBy: SalesGroupBy;
    items: (SalesFigures & { from: string; to: string })[];
  };
  /** Present when asked for. */
  topProducts?: {
    orderedBy: TopProductsOrder;
    items: { name: string; quantitySold: number; revenue: number }[];
  };
}
