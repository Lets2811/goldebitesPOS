import { DashboardService } from './dashboard.service';

describe('DashboardService', () => {
  let businessesService: { getTimezone: jest.Mock };
  let ordersService: { getSalesSummary: jest.Mock; getActiveCount: jest.Mock };
  let movementsService: { getLowStockAlerts: jest.Mock };
  let cashSessionsService: { hasOpenSession: jest.Mock };
  let service: DashboardService;

  const businessId = 'business-1';
  const branchId = 'branch-1';

  beforeEach(() => {
    ordersService = {
      getSalesSummary: jest
        .fn()
        .mockResolvedValue({ orderCount: 0, totalAmount: 0 }),
      getActiveCount: jest.fn().mockResolvedValue(0),
    };
    movementsService = { getLowStockAlerts: jest.fn().mockResolvedValue([]) };
    cashSessionsService = { hasOpenSession: jest.fn().mockResolvedValue(true) };
    businessesService = {
      getTimezone: jest.fn().mockResolvedValue('America/Bogota'),
    };
    service = new DashboardService(
      businessesService as never,
      ordersService as never,
      movementsService as never,
      cashSessionsService as never,
    );
  });

  it('computes averageTicket from totalAmount / orderCount', async () => {
    ordersService.getSalesSummary.mockResolvedValue({
      orderCount: 3,
      totalAmount: 30000,
    });

    const summary = await service.getSummary(businessId, branchId);

    expect(summary.todaySales).toEqual({
      orderCount: 3,
      totalAmount: 30000,
      averageTicket: 10000,
    });
  });

  it('averageTicket is 0 when there are no sales (avoids division by zero)', async () => {
    const summary = await service.getSummary(businessId, branchId);
    expect(summary.todaySales.averageTicket).toBe(0);
  });

  it('reports lowStockCount from the alert list length', async () => {
    movementsService.getLowStockAlerts.mockResolvedValue([{}, {}]);

    const summary = await service.getSummary(businessId, branchId);
    expect(summary.lowStockCount).toBe(2);
  });

  it('skips the cash session check when no branch is given (null, not false)', async () => {
    const summary = await service.getSummary(businessId);

    expect(cashSessionsService.hasOpenSession).not.toHaveBeenCalled();
    expect(summary.cashSessionOpen).toBeNull();
  });

  it('reports cashSessionOpen when a branch is given', async () => {
    cashSessionsService.hasOpenSession.mockResolvedValue(false);

    const summary = await service.getSummary(businessId, branchId);

    expect(cashSessionsService.hasOpenSession).toHaveBeenCalledWith(
      businessId,
      branchId,
    );
    expect(summary.cashSessionOpen).toBe(false);
  });

  describe("today's range", () => {
    afterEach(() => jest.useRealTimers());

    it("starts at the business's midnight, not the server's", async () => {
      // 9 PM on October 13th in Bogotá, which is already the 14th in UTC.
      jest.useFakeTimers().setSystemTime(new Date('2026-10-14T02:00:00.000Z'));

      await service.getSummary(businessId, branchId);

      expect(businessesService.getTimezone).toHaveBeenCalledWith(businessId);
      expect(ordersService.getSalesSummary).toHaveBeenCalledWith(
        businessId,
        branchId,
        '2026-10-13T05:00:00.000Z',
        '2026-10-14T02:00:00.000Z',
      );
    });

    it("follows the business's own timezone", async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-10-14T02:00:00.000Z'));
      businessesService.getTimezone.mockResolvedValue('Europe/Madrid');

      await service.getSummary(businessId, branchId);

      // 4 AM on the 14th in Madrid: the day began at 22:00 UTC on the 13th.
      expect(ordersService.getSalesSummary).toHaveBeenCalledWith(
        businessId,
        branchId,
        '2026-10-13T22:00:00.000Z',
        '2026-10-14T02:00:00.000Z',
      );
    });
  });
});
