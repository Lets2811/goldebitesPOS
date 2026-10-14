import { Injectable } from '@nestjs/common';
import {
  businessDayStart,
  businessToday,
} from '../../../common/utils/business-day.util';
import { BusinessesService } from '../../businesses/services/businesses.service';
import { CashSessionsService } from '../../cash-sessions/services/cash-sessions.service';
import { InventoryMovementsService } from '../../inventory-movements/services/inventory-movements.service';
import { OrdersService } from '../../orders/services/orders.service';

export interface DashboardSummary {
  todaySales: {
    orderCount: number;
    totalAmount: number;
    averageTicket: number;
  };
  activeOrders: number;
  lowStockCount: number;
  cashSessionOpen: boolean | null;
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly businessesService: BusinessesService,
    private readonly ordersService: OrdersService,
    private readonly movementsService: InventoryMovementsService,
    private readonly cashSessionsService: CashSessionsService,
  ) {}

  async getSummary(
    businessId: string,
    branchId?: string,
  ): Promise<DashboardSummary> {
    const timezone = await this.businessesService.getTimezone(businessId);
    const { dateFrom, dateTo } = todayRange(timezone);

    const [salesSummary, activeOrders, lowStockAlerts, cashSessionOpen] =
      await Promise.all([
        this.ordersService.getSalesSummary(
          businessId,
          branchId,
          dateFrom,
          dateTo,
        ),
        this.ordersService.getActiveCount(businessId, branchId),
        this.movementsService.getLowStockAlerts(businessId, branchId),
        branchId
          ? this.cashSessionsService.hasOpenSession(businessId, branchId)
          : null,
      ]);

    const averageTicket =
      salesSummary.orderCount > 0
        ? round2(salesSummary.totalAmount / salesSummary.orderCount)
        : 0;

    return {
      todaySales: { ...salesSummary, averageTicket },
      activeOrders,
      lowStockCount: lowStockAlerts.length,
      cashSessionOpen,
    };
  }
}

/**
 * From the start of today to now. Today is the business's calendar day: with
 * the server's own clock (UTC in production) the day would start at 7 PM in
 * Bogotá and the evening's sales would land on tomorrow.
 */
function todayRange(timezone: string): { dateFrom: string; dateTo: string } {
  const now = new Date();
  const startOfDay = businessDayStart(businessToday(timezone, now), timezone);
  return { dateFrom: startOfDay.toISOString(), dateTo: now.toISOString() };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
