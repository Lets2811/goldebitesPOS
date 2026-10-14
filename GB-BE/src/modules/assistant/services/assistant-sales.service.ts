import { Injectable } from '@nestjs/common';
import { BusinessRuleException } from '../../../common/exceptions';
import {
  addDays,
  businessDayRange,
  daysInRange,
} from '../../../common/utils/business-day.util';
import { AnalyticsService } from '../../analytics/services/analytics.service';
import { BranchesService } from '../../branches/services/branches.service';
import { BusinessesService } from '../../businesses/services/businesses.service';
import { DailySales } from '../../orders/domain/order.interface';
import {
  AssistantSalesQuery,
  AssistantSalesResult,
  MAX_DAILY_RANGE_DAYS,
  MAX_RANGE_DAYS,
  SalesFigures,
  SalesGroupBy,
} from '../domain/assistant-sales.interface';

interface BranchScope {
  /** The branch to limit the figures to; undefined for the whole business. */
  branchId: string | undefined;
  scope: AssistantSalesResult['scope'];
}

/**
 * Sales of a range of days, as the assistant needs them: one total, and on
 * request how it spreads over time and which products made it. Read-only.
 *
 * A sale is what AnalyticsService counts as one — an order paid in full and
 * not cancelled, on the day it was paid — and every figure comes from there. What this adds
 * is the calendar: the range arrives as days of the business, and is turned
 * into the instants those days cover in the business's own timezone.
 */
@Injectable()
export class AssistantSalesService {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly businessesService: BusinessesService,
    private readonly branchesService: BranchesService,
  ) {}

  async getSales(query: AssistantSalesQuery): Promise<AssistantSalesResult> {
    assertRange(query);

    const [timezone, { branchId, scope }] = await Promise.all([
      this.businessesService.getTimezone(query.businessId),
      this.resolveBranch(query.businessId, query.branchName),
    ]);
    const { dateFrom, dateTo } = businessDayRange(
      query.dateFrom,
      query.dateTo,
      timezone,
    );
    const range = [query.businessId, branchId, dateFrom, dateTo] as const;

    const [summary, days, topProducts] = await Promise.all([
      this.analyticsService.getSalesSummary(...range),
      query.groupBy ? this.analyticsService.getSalesByDay(...range) : null,
      query.includeTopProducts
        ? this.analyticsService.getTopProducts(
            ...range,
            query.topProductsLimit,
            query.topProductsOrder,
          )
        : null,
    ]);

    return {
      period: { from: query.dateFrom, to: query.dateTo, timezone },
      scope,
      summary: {
        totalSales: summary.totalAmount,
        orderCount: summary.orderCount,
        averageTicket:
          summary.orderCount > 0
            ? round2(summary.totalAmount / summary.orderCount)
            : 0,
      },
      ...(query.groupBy &&
        days && {
          breakdown: {
            groupBy: query.groupBy,
            items: groupDays(days, query.groupBy, query),
          },
        }),
      ...(topProducts && {
        topProducts: {
          orderedBy: query.topProductsOrder,
          // The product id stays here: a name is all the assistant needs to answer.
          items: topProducts.map((product) => ({
            name: product.productName,
            quantitySold: product.quantitySold,
            revenue: product.revenue,
          })),
        },
      }),
    };
  }

  /**
   * Which branch the figures are for. Nothing asked means the whole business.
   * A business with a single branch has nothing to choose between, so a name
   * is ignored there. Otherwise the name has to point at exactly one active
   * branch: an unknown or ambiguous one is refused with the names to pick
   * from, rather than answered with some other branch's sales.
   */
  private async resolveBranch(
    businessId: string,
    branchName: string | undefined,
  ): Promise<BranchScope> {
    const { data: branches } = await this.branchesService.findAll({
      businessId,
      isActive: true,
      page: 1,
      limit: 100,
    });
    if (branches.length <= 1) {
      return { branchId: undefined, scope: { branch: null } };
    }

    const names = branches.map((branch) => branch.name);
    if (!branchName?.trim()) {
      return { branchId: undefined, scope: { branch: null, branches: names } };
    }

    const wanted = normalize(branchName);
    const exact = branches.filter(
      (branch) => normalize(branch.name) === wanted,
    );
    const matches =
      exact.length > 0
        ? exact
        : branches.filter((branch) => normalize(branch.name).includes(wanted));
    if (matches.length !== 1) {
      throw new BusinessRuleException(
        matches.length === 0
          ? `No active branch is called "${branchName}". Branches: ${names.join(', ')}`
          : `"${branchName}" matches several branches: ${matches.map((branch) => branch.name).join(', ')}`,
        matches.length === 0 ? 'BRANCH_NOT_FOUND' : 'BRANCH_AMBIGUOUS',
        { branches: names },
      );
    }
    return {
      branchId: matches[0].id,
      scope: { branch: matches[0].name, branches: names },
    };
  }
}

function assertRange(query: AssistantSalesQuery): void {
  if (query.dateFrom > query.dateTo) {
    throw new BusinessRuleException(
      'dateFrom must not be after dateTo',
      'INVALID_DATE_RANGE',
    );
  }
  const days = daysInRange(query.dateFrom, query.dateTo);
  if (days > MAX_RANGE_DAYS) {
    throw new BusinessRuleException(
      `The range covers ${days} days; at most ${MAX_RANGE_DAYS} can be queried at once`,
      'RANGE_TOO_LONG',
    );
  }
  if (query.groupBy === 'day' && days > MAX_DAILY_RANGE_DAYS) {
    throw new BusinessRuleException(
      `A day-by-day breakdown covers at most ${MAX_DAILY_RANGE_DAYS} days (asked for ${days}); group by week or month instead`,
      'RANGE_TOO_LONG_FOR_DAILY_BREAKDOWN',
    );
  }
}

/** Branch names are compared without regard to case, accents or surrounding space. */
function normalize(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase();
}

/** Monday of the week a day falls in: weeks run Monday to Sunday. */
function weekStart(day: string): string {
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
  return addDays(day, -((weekday + 6) % 7));
}

/** Last day of the month a day falls in. */
function monthEnd(day: string): string {
  const [year, month] = day.split('-').map(Number);
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

/**
 * Adds the daily figures up into the periods asked for. Each period is
 * clipped to the range, so a week cut short by it says so in its own dates
 * instead of looking like a whole week.
 */
function groupDays(
  days: DailySales[],
  groupBy: SalesGroupBy,
  range: { dateFrom: string; dateTo: string },
): (SalesFigures & { from: string; to: string })[] {
  const periods = new Map<
    string,
    SalesFigures & { from: string; to: string }
  >();
  for (const day of days) {
    const [from, to] =
      groupBy === 'day'
        ? [day.date, day.date]
        : groupBy === 'week'
          ? [weekStart(day.date), addDays(weekStart(day.date), 6)]
          : [`${day.date.slice(0, 7)}-01`, monthEnd(day.date)];
    const period = periods.get(from) ?? {
      from: from < range.dateFrom ? range.dateFrom : from,
      to: to > range.dateTo ? range.dateTo : to,
      totalSales: 0,
      orderCount: 0,
    };
    period.totalSales = round2(period.totalSales + day.totalAmount);
    period.orderCount += day.orderCount;
    periods.set(from, period);
  }
  return [...periods.values()];
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
