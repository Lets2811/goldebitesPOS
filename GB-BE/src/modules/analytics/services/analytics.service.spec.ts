import { BusinessRuleException } from '../../../common/exceptions';
import { AnalyticsService } from './analytics.service';

describe('AnalyticsService', () => {
  let ordersService: {
    getSalesSummary: jest.Mock;
    getSalesByDay: jest.Mock;
    getTopProducts: jest.Mock;
  };
  let service: AnalyticsService;

  const businessId = 'business-1';
  const branchId = 'branch-1';

  beforeEach(() => {
    ordersService = {
      getSalesSummary: jest
        .fn()
        .mockResolvedValue({ orderCount: 0, totalAmount: 0 }),
      getSalesByDay: jest.fn().mockResolvedValue([]),
      getTopProducts: jest.fn().mockResolvedValue([]),
    };
    service = new AnalyticsService(ordersService as never);
  });

  describe('getSalesByDay', () => {
    it('rejects a range where dateFrom is after dateTo', async () => {
      await expect(
        service.getSalesByDay(businessId, branchId, '2026-02-01', '2026-01-01'),
      ).rejects.toThrow(BusinessRuleException);
      expect(ordersService.getSalesByDay).not.toHaveBeenCalled();
    });

    it('delegates to OrdersService for a valid range', async () => {
      await service.getSalesByDay(
        businessId,
        branchId,
        '2026-01-01',
        '2026-01-31',
      );
      expect(ordersService.getSalesByDay).toHaveBeenCalledWith(
        businessId,
        branchId,
        '2026-01-01',
        '2026-01-31',
      );
    });
  });

  describe('getTopProducts', () => {
    it('rejects a range where dateFrom is after dateTo', async () => {
      await expect(
        service.getTopProducts(
          businessId,
          branchId,
          '2026-02-01',
          '2026-01-01',
          10,
        ),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('delegates to OrdersService with the limit', async () => {
      await service.getTopProducts(
        businessId,
        branchId,
        '2026-01-01',
        '2026-01-31',
        5,
      );
      expect(ordersService.getTopProducts).toHaveBeenCalledWith(
        businessId,
        branchId,
        '2026-01-01',
        '2026-01-31',
        5,
        'revenue',
      );
    });
  });

  it('getTopProducts() ranks by quantity when asked', async () => {
    await service.getTopProducts(
      businessId,
      branchId,
      '2026-01-01',
      '2026-01-31',
      5,
      'quantity',
    );
    expect(ordersService.getTopProducts).toHaveBeenCalledWith(
      businessId,
      branchId,
      '2026-01-01',
      '2026-01-31',
      5,
      'quantity',
    );
  });

  describe('getSalesSummary', () => {
    it('rejects a range where dateFrom is after dateTo', async () => {
      await expect(
        service.getSalesSummary(
          businessId,
          branchId,
          '2026-02-01',
          '2026-01-01',
        ),
      ).rejects.toThrow(BusinessRuleException);
      expect(ordersService.getSalesSummary).not.toHaveBeenCalled();
    });

    it('delegates to OrdersService', async () => {
      ordersService.getSalesSummary.mockResolvedValue({
        orderCount: 4,
        totalAmount: 80000,
      });

      const summary = await service.getSalesSummary(
        businessId,
        branchId,
        '2026-01-01',
        '2026-01-31',
      );

      expect(ordersService.getSalesSummary).toHaveBeenCalledWith(
        businessId,
        branchId,
        '2026-01-01',
        '2026-01-31',
      );
      expect(summary).toEqual({ orderCount: 4, totalAmount: 80000 });
    });
  });
});
