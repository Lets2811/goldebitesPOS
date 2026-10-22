import { Injectable } from '@nestjs/common';
import { BusinessRuleException } from '../../common/exceptions';
import { BusinessesService } from '../businesses/services/businesses.service';
import { BranchComparisonRepository } from './branch-comparison.repository';

export interface BranchFigures {
  branchId: string;
  name: string;
  isActive: boolean;
  orderCount: number;
  salesTotal: number;
  /** salesTotal / orderCount, 0 without sales. */
  averageTicket: number;
  discountTotal: number;
  expenseTotal: number;
  wasteTotal: number;
  /** Right now, not in the range: orders still being worked on. */
  activeOrders: number;
  /** Right now: whether the branch has a cash session open. */
  cashOpen: boolean;
}

export interface BranchComparison {
  branches: BranchFigures[];
  /** Sales per day, each with an amount per branch id (0 when it sold nothing). */
  daily: { date: string; sales: Record<string, number> }[];
}

const round2 = (value: number) => Math.round(value * 100) / 100;

@Injectable()
export class BranchComparisonService {
  constructor(
    private readonly repository: BranchComparisonRepository,
    private readonly businessesService: BusinessesService,
  ) {}

  async compare(
    businessId: string,
    dateFrom: string,
    dateTo: string,
  ): Promise<BranchComparison> {
    if (new Date(dateFrom) > new Date(dateTo)) {
      throw new BusinessRuleException(
        'La fecha inicial debe ser anterior a la final',
        'INVALID_DATE_RANGE',
      );
    }
    const timezone = await this.businessesService.getTimezone(businessId);
    const [rows, dailyRows] = await Promise.all([
      this.repository.figures(businessId, dateFrom, dateTo, timezone),
      this.repository.dailySales(businessId, dateFrom, dateTo, timezone),
    ]);

    const branches = rows.map((row): BranchFigures => {
      const orderCount = parseInt(row.order_count, 10);
      const salesTotal = parseFloat(row.sales_total);
      return {
        branchId: row.branch_id,
        name: row.name,
        isActive: row.is_active,
        orderCount,
        salesTotal,
        averageTicket: orderCount > 0 ? round2(salesTotal / orderCount) : 0,
        discountTotal: parseFloat(row.discount_total),
        expenseTotal: parseFloat(row.expense_total),
        wasteTotal: round2(parseFloat(row.waste_total)),
        activeOrders: parseInt(row.active_orders, 10),
        cashOpen: row.cash_open,
      };
    });

    const byDate = new Map<string, Record<string, number>>();
    for (const row of dailyRows) {
      const day =
        byDate.get(row.date) ??
        Object.fromEntries(branches.map((branch) => [branch.branchId, 0]));
      day[row.branch_id] = parseFloat(row.sales_total);
      byDate.set(row.date, day);
    }
    const daily = [...byDate.entries()].map(([date, sales]) => ({
      date,
      sales,
    }));

    return { branches, daily };
  }
}
