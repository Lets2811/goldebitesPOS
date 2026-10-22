import { Injectable } from '@nestjs/common';
import { BusinessRuleException } from '../../../common/exceptions';
import {
  businessDayRange,
  daysInRange,
} from '../../../common/utils/business-day.util';
import { BranchComparisonService } from '../../branch-comparison/branch-comparison.service';
import { BusinessesService } from '../../businesses/services/businesses.service';
import { MAX_RANGE_DAYS } from '../domain/assistant-sales.interface';

/** One branch's figures for the range, as the assistant needs them. */
export interface AssistantBranchFigures {
  name: string;
  isActive: boolean;
  totalSales: number;
  orderCount: number;
  averageTicket: number;
  discountTotal: number;
  expenseTotal: number;
  wasteTotal: number;
  /** Right now, not in the range: orders still being worked on. */
  activeOrders: number;
  /** Right now: whether the branch has a cash session open. */
  cashOpen: boolean;
}

/**
 * Every branch side by side for a range of days, for whoever may see them
 * all: the figures of the branch comparison screen, from the service that
 * owns them. What this adds is the calendar, as for sales: the range arrives
 * as days of the business and is turned into the instants they cover.
 */
@Injectable()
export class AssistantBranchComparisonService {
  constructor(
    private readonly branchComparisonService: BranchComparisonService,
    private readonly businessesService: BusinessesService,
  ) {}

  async compare(
    businessId: string,
    dayFrom: string,
    dayTo: string,
  ): Promise<{
    period: { from: string; to: string; timezone: string };
    branches: AssistantBranchFigures[];
  }> {
    if (dayFrom > dayTo) {
      throw new BusinessRuleException(
        'dateFrom must not be after dateTo',
        'INVALID_DATE_RANGE',
      );
    }
    const days = daysInRange(dayFrom, dayTo);
    if (days > MAX_RANGE_DAYS) {
      throw new BusinessRuleException(
        `The range covers ${days} days; at most ${MAX_RANGE_DAYS} can be queried at once`,
        'RANGE_TOO_LONG',
      );
    }
    const timezone = await this.businessesService.getTimezone(businessId);
    const { dateFrom, dateTo } = businessDayRange(dayFrom, dayTo, timezone);
    const { branches } = await this.branchComparisonService.compare(
      businessId,
      dateFrom,
      dateTo,
    );
    return {
      period: { from: dayFrom, to: dayTo, timezone },
      branches: branches.map((branch) => ({
        name: branch.name,
        isActive: branch.isActive,
        totalSales: branch.salesTotal,
        orderCount: branch.orderCount,
        averageTicket: branch.averageTicket,
        discountTotal: branch.discountTotal,
        expenseTotal: branch.expenseTotal,
        wasteTotal: branch.wasteTotal,
        activeOrders: branch.activeOrders,
        cashOpen: branch.cashOpen,
      })),
    };
  }
}
