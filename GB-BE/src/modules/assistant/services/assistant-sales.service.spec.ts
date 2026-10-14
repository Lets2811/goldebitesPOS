import { BusinessRuleException } from '../../../common/exceptions';
import { DailySales } from '../../orders/domain/order.interface';
import { AssistantSalesQuery } from '../domain/assistant-sales.interface';
import { AssistantSalesService } from './assistant-sales.service';

describe('AssistantSalesService', () => {
  let analyticsService: {
    getSalesSummary: jest.Mock;
    getSalesByDay: jest.Mock;
    getTopProducts: jest.Mock;
  };
  let businessesService: { getTimezone: jest.Mock };
  let branchesService: { findAll: jest.Mock };
  let service: AssistantSalesService;

  const businessId = 'business-1';

  function makeQuery(
    overrides: Partial<AssistantSalesQuery> = {},
  ): AssistantSalesQuery {
    return {
      businessId,
      dateFrom: '2026-10-01',
      dateTo: '2026-10-13',
      includeTopProducts: false,
      topProductsLimit: 5,
      topProductsOrder: 'quantity',
      ...overrides,
    };
  }

  function givenBranches(...names: string[]) {
    branchesService.findAll.mockResolvedValue({
      data: names.map((name, index) => ({ id: `branch-${index + 1}`, name })),
      meta: { total: names.length },
    });
  }

  const day = (
    date: string,
    totalAmount: number,
    orderCount = 1,
  ): DailySales => ({
    date,
    totalAmount,
    orderCount,
  });

  beforeEach(() => {
    analyticsService = {
      getSalesSummary: jest
        .fn()
        .mockResolvedValue({ orderCount: 0, totalAmount: 0 }),
      getSalesByDay: jest.fn().mockResolvedValue([]),
      getTopProducts: jest.fn().mockResolvedValue([]),
    };
    businessesService = {
      getTimezone: jest.fn().mockResolvedValue('America/Bogota'),
    };
    branchesService = { findAll: jest.fn() };
    givenBranches('Sede Principal');
    service = new AssistantSalesService(
      analyticsService as never,
      businessesService as never,
      branchesService as never,
    );
  });

  describe('the range', () => {
    it("turns one calendar day into the instants it covers in the business's timezone", async () => {
      await service.getSales(
        makeQuery({ dateFrom: '2026-10-13', dateTo: '2026-10-13' }),
      );

      // Midnight to midnight in Bogotá, so an 11:30 PM sale stays on the 13th.
      expect(analyticsService.getSalesSummary).toHaveBeenCalledWith(
        businessId,
        undefined,
        '2026-10-13T05:00:00.000Z',
        '2026-10-14T04:59:59.999Z',
      );
    });

    it("uses the business's own timezone, whatever it is", async () => {
      businessesService.getTimezone.mockResolvedValue('Europe/Madrid');

      const result = await service.getSales(
        makeQuery({ dateFrom: '2026-10-13', dateTo: '2026-10-13' }),
      );

      expect(businessesService.getTimezone).toHaveBeenCalledWith(businessId);
      expect(analyticsService.getSalesSummary).toHaveBeenCalledWith(
        businessId,
        undefined,
        '2026-10-12T22:00:00.000Z',
        '2026-10-13T21:59:59.999Z',
      );
      expect(result.period).toEqual({
        from: '2026-10-13',
        to: '2026-10-13',
        timezone: 'Europe/Madrid',
      });
    });

    it('covers several days, across months and across years', async () => {
      await service.getSales(
        makeQuery({ dateFrom: '2026-09-15', dateTo: '2026-10-05' }),
      );
      await service.getSales(
        makeQuery({ dateFrom: '2025-12-30', dateTo: '2026-01-02' }),
      );

      expect(analyticsService.getSalesSummary).toHaveBeenNthCalledWith(
        1,
        businessId,
        undefined,
        '2026-09-15T05:00:00.000Z',
        '2026-10-06T04:59:59.999Z',
      );
      expect(analyticsService.getSalesSummary).toHaveBeenNthCalledWith(
        2,
        businessId,
        undefined,
        '2025-12-30T05:00:00.000Z',
        '2026-01-03T04:59:59.999Z',
      );
    });

    it('rejects a range that ends before it starts', async () => {
      await expect(
        service.getSales(
          makeQuery({ dateFrom: '2026-10-13', dateTo: '2026-10-01' }),
        ),
      ).rejects.toThrow(BusinessRuleException);
      expect(analyticsService.getSalesSummary).not.toHaveBeenCalled();
    });

    it('accepts a whole year and rejects more', async () => {
      await expect(
        service.getSales(
          makeQuery({ dateFrom: '2028-01-01', dateTo: '2028-12-31' }),
        ),
      ).resolves.toBeDefined();

      await expect(
        service.getSales(
          makeQuery({ dateFrom: '2025-01-01', dateTo: '2026-01-02' }),
        ),
      ).rejects.toMatchObject({ code: 'RANGE_TOO_LONG' });
    });

    it('breaks down by day a full month at most', async () => {
      await expect(
        service.getSales(
          makeQuery({
            dateFrom: '2026-10-01',
            dateTo: '2026-10-31',
            groupBy: 'day',
          }),
        ),
      ).resolves.toBeDefined();

      await expect(
        service.getSales(
          makeQuery({
            dateFrom: '2026-10-01',
            dateTo: '2026-11-01',
            groupBy: 'day',
          }),
        ),
      ).rejects.toMatchObject({ code: 'RANGE_TOO_LONG_FOR_DAILY_BREAKDOWN' });

      // The same range is fine by week or by month.
      await expect(
        service.getSales(
          makeQuery({
            dateFrom: '2026-01-01',
            dateTo: '2026-12-31',
            groupBy: 'month',
          }),
        ),
      ).resolves.toBeDefined();
    });
  });

  describe('the summary', () => {
    it('reports the total, the number of sales and the average ticket', async () => {
      analyticsService.getSalesSummary.mockResolvedValue({
        orderCount: 248,
        totalAmount: 3250000,
      });

      const result = await service.getSales(makeQuery());

      expect(result.summary).toEqual({
        totalSales: 3250000,
        orderCount: 248,
        averageTicket: 13104.84,
      });
    });

    it('answers a period without sales with zeros, not with an error', async () => {
      const result = await service.getSales(
        makeQuery({
          groupBy: 'day',
          includeTopProducts: true,
        }),
      );

      expect(result.summary).toEqual({
        totalSales: 0,
        orderCount: 0,
        averageTicket: 0,
      });
      expect(result.breakdown).toEqual({ groupBy: 'day', items: [] });
      expect(result.topProducts).toEqual({ orderedBy: 'quantity', items: [] });
    });

    it('asks for nothing it was not asked for', async () => {
      const result = await service.getSales(makeQuery());

      expect(analyticsService.getSalesByDay).not.toHaveBeenCalled();
      expect(analyticsService.getTopProducts).not.toHaveBeenCalled();
      expect(result).not.toHaveProperty('breakdown');
      expect(result).not.toHaveProperty('topProducts');
    });
  });

  describe('the breakdown', () => {
    beforeEach(() => {
      analyticsService.getSalesByDay.mockResolvedValue([
        day('2026-09-28', 100, 1), // Monday
        day('2026-09-30', 200, 2),
        day('2026-10-01', 300, 3), // Thursday, same week, next month
        day('2026-10-04', 400, 4), // Sunday
        day('2026-10-05', 500, 5), // Monday of the next week
      ]);
    });

    const range = { dateFrom: '2026-09-28', dateTo: '2026-10-05' };

    it('by day, lists each day that had sales', async () => {
      const result = await service.getSales(
        makeQuery({ ...range, groupBy: 'day' }),
      );

      expect(result.breakdown?.groupBy).toBe('day');
      expect(result.breakdown?.items).toHaveLength(5);
      expect(result.breakdown?.items[0]).toEqual({
        from: '2026-09-28',
        to: '2026-09-28',
        totalSales: 100,
        orderCount: 1,
      });
    });

    it('by week, adds up Monday to Sunday', async () => {
      const result = await service.getSales(
        makeQuery({ ...range, groupBy: 'week' }),
      );

      expect(result.breakdown?.items).toEqual([
        {
          from: '2026-09-28',
          to: '2026-10-04',
          totalSales: 1000,
          orderCount: 10,
        },
        // Cut short by the range: the week's own Sunday is the 11th.
        {
          from: '2026-10-05',
          to: '2026-10-05',
          totalSales: 500,
          orderCount: 5,
        },
      ]);
    });

    it('by month, adds up each calendar month, clipped to the range', async () => {
      const result = await service.getSales(
        makeQuery({ ...range, groupBy: 'month' }),
      );

      expect(result.breakdown?.items).toEqual([
        {
          from: '2026-09-28',
          to: '2026-09-30',
          totalSales: 300,
          orderCount: 3,
        },
        {
          from: '2026-10-01',
          to: '2026-10-05',
          totalSales: 1200,
          orderCount: 12,
        },
      ]);
    });

    it('reads the days from Analytics with the same range as the summary', async () => {
      await service.getSales(makeQuery({ ...range, groupBy: 'week' }));

      expect(analyticsService.getSalesByDay).toHaveBeenCalledWith(
        ...(analyticsService.getSalesSummary.mock.calls[0] as unknown[]),
      );
    });
  });

  describe('the best-selling products', () => {
    beforeEach(() => {
      analyticsService.getTopProducts.mockResolvedValue([
        {
          productId: 'product-1',
          productName: 'Combo Nuggets x6',
          quantitySold: 42,
          revenue: 504000,
        },
      ]);
    });

    it('returns names and figures, and no internal ids', async () => {
      const result = await service.getSales(
        makeQuery({ includeTopProducts: true }),
      );

      expect(result.topProducts).toEqual({
        orderedBy: 'quantity',
        items: [
          { name: 'Combo Nuggets x6', quantitySold: 42, revenue: 504000 },
        ],
      });
    });

    it('passes the limit and the ranking on to Analytics', async () => {
      await service.getSales(
        makeQuery({
          includeTopProducts: true,
          topProductsLimit: 3,
          topProductsOrder: 'revenue',
        }),
      );

      expect(analyticsService.getTopProducts).toHaveBeenCalledWith(
        businessId,
        undefined,
        expect.any(String),
        expect.any(String),
        3,
        'revenue',
      );
    });
  });

  describe('the branch', () => {
    it('a business with one branch has nothing to choose: its sales are simply its sales', async () => {
      givenBranches('Sede Principal');

      const result = await service.getSales(
        makeQuery({ branchName: 'cualquiera' }),
      );

      expect(result.scope).toEqual({ branch: null });
      expect(analyticsService.getSalesSummary).toHaveBeenCalledWith(
        businessId,
        undefined,
        expect.any(String),
        expect.any(String),
      );
    });

    it('with several branches and none named, covers the whole business and says which branches exist', async () => {
      givenBranches('Centro', 'Norte');

      const result = await service.getSales(makeQuery());

      expect(result.scope).toEqual({
        branch: null,
        branches: ['Centro', 'Norte'],
      });
      expect(analyticsService.getSalesSummary).toHaveBeenCalledWith(
        businessId,
        undefined,
        expect.any(String),
        expect.any(String),
      );
    });

    it('limits every figure to the branch that was named', async () => {
      givenBranches('Centro', 'Norte');

      const result = await service.getSales(
        makeQuery({
          branchName: 'Norte',
          groupBy: 'day',
          includeTopProducts: true,
        }),
      );

      expect(result.scope.branch).toBe('Norte');
      for (const call of [
        analyticsService.getSalesSummary,
        analyticsService.getSalesByDay,
        analyticsService.getTopProducts,
      ]) {
        expect((call.mock.calls[0] as unknown[]).slice(0, 2)).toEqual([
          businessId,
          'branch-2',
        ]);
      }
    });

    it('finds a branch whatever the case, accents or partial name', async () => {
      givenBranches('Sede Chapinero', 'Sede Usaquén');

      expect(
        (await service.getSales(makeQuery({ branchName: 'usaquen' }))).scope
          .branch,
      ).toBe('Sede Usaquén');
      expect(
        (await service.getSales(makeQuery({ branchName: ' CHAPINERO ' }))).scope
          .branch,
      ).toBe('Sede Chapinero');
    });

    it('refuses an unknown branch, naming the ones there are, instead of answering for another', async () => {
      givenBranches('Centro', 'Norte');

      await expect(
        service.getSales(makeQuery({ branchName: 'Sur' })),
      ).rejects.toMatchObject({
        code: 'BRANCH_NOT_FOUND',
        message: expect.stringContaining('Centro, Norte') as string,
      });
      expect(analyticsService.getSalesSummary).not.toHaveBeenCalled();
    });

    it('refuses a name that fits several branches', async () => {
      givenBranches('Sede Norte', 'Sede Norte 2', 'Centro');

      await expect(
        service.getSales(makeQuery({ branchName: 'sede' })),
      ).rejects.toMatchObject({ code: 'BRANCH_AMBIGUOUS' });

      // An exact name wins over the ones that merely contain it.
      expect(
        (await service.getSales(makeQuery({ branchName: 'sede norte' }))).scope
          .branch,
      ).toBe('Sede Norte');
    });

    it("only ever looks at the caller's own business", async () => {
      await service.getSales(makeQuery());

      expect(branchesService.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ businessId, isActive: true }),
      );
      expect(businessesService.getTimezone).toHaveBeenCalledWith(businessId);
    });
  });
});
