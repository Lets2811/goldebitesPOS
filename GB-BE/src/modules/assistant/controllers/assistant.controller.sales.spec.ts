import { ExecutionContext, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UnauthorizedOperationException } from '../../../common/exceptions';
import { FeaturesGuard } from '../../../common/guards/features.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { AuthenticatedUser } from '../../../common/interfaces/authenticated-user.interface';
import { AssistantSalesQueryDto } from '../dto/assistant-sales-query.dto';
import { AssistantProductsService } from '../services/assistant-products.service';
import { AssistantSalesService } from '../services/assistant-sales.service';
import { AssistantService } from '../services/assistant.service';
import { AssistantController } from './assistant.controller';

describe('AssistantController — GET /assistant/sales', () => {
  let salesService: jest.Mocked<Pick<AssistantSalesService, 'getSales'>>;
  let controller: AssistantController;

  function makeUser(
    overrides: Partial<AuthenticatedUser> = {},
  ): AuthenticatedUser {
    return {
      userId: 'user-1',
      businessId: 'business-1',
      branchId: 'branch-1',
      roleId: 'role-1',
      roleName: 'MANAGER',
      permissions: ['analytics.read'],
      enabledFeatures: ['analytics'],
      mustChangePassword: false,
      ...overrides,
    };
  }

  /** The request as the guards see it: this handler, called by this user. */
  function contextFor(user: AuthenticatedUser): ExecutionContext {
    return {
      // eslint-disable-next-line @typescript-eslint/unbound-method -- the guards only read its metadata
      getHandler: () => AssistantController.prototype.getSales,
      getClass: () => AssistantController,
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    } as unknown as ExecutionContext;
  }

  /** The query as the API's validation pipe would hand it to the controller. */
  function parseQuery(raw: Record<string, string>) {
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    });
    return pipe.transform(raw, {
      type: 'query',
      metatype: AssistantSalesQueryDto,
    }) as Promise<AssistantSalesQueryDto>;
  }

  const range = { dateFrom: '2026-10-01', dateTo: '2026-10-13' };

  const branchScope = {
    resolve: jest.fn().mockResolvedValue({
      branchId: 'branch-1',
      scope: { branch: null },
      single: true,
      namesById: new Map([['branch-1', 'Centro']]),
      active: [{ id: 'branch-1', name: 'Centro' }],
    }),
  };

  beforeEach(() => {
    salesService = { getSales: jest.fn() };
    controller = new AssistantController(
      new AssistantService(),
      {} as AssistantProductsService,
      salesService as unknown as AssistantSalesService,
      {} as never,
      branchScope as never,
      {} as never,
    );
  });

  it('takes the business from the session and the rest from the query, with its defaults', async () => {
    const user = makeUser();
    await controller.getSales('business-1', user, await parseQuery(range));

    expect(salesService.getSales).toHaveBeenCalledWith({
      businessId: 'business-1',
      user,
      dateFrom: '2026-10-01',
      dateTo: '2026-10-13',
      branchName: undefined,
      groupBy: undefined,
      includeTopProducts: false,
      topProductsLimit: 5,
      topProductsOrder: 'quantity',
    });
  });

  it('forwards the grouping, the products and a branch named by the user', async () => {
    await controller.getSales(
      'business-1',
      makeUser(),
      await parseQuery({
        ...range,
        groupBy: 'week',
        includeTopProducts: 'true',
        topProductsLimit: '3',
        topProductsOrder: 'revenue',
        branch: 'Norte',
      }),
    );

    expect(salesService.getSales).toHaveBeenCalledWith(
      expect.objectContaining({
        groupBy: 'week',
        includeTopProducts: true,
        topProductsLimit: 3,
        topProductsOrder: 'revenue',
        branchName: 'Norte',
      }),
    );
  });

  describe('query', () => {
    it('needs both ends of the range', async () => {
      await expect(parseQuery({ dateFrom: '2026-10-01' })).rejects.toThrow();
      await expect(parseQuery({ dateTo: '2026-10-13' })).rejects.toThrow();
    });

    it('takes calendar days only: not instants, other formats or days that do not exist', async () => {
      for (const dateFrom of [
        '2026-10-01T00:00:00Z',
        '01/10/2026',
        '2026-02-30',
        'ayer',
        'esta semana',
      ]) {
        await expect(parseQuery({ ...range, dateFrom })).rejects.toThrow();
      }
    });

    it('reads includeTopProducts as sent — "false" is false', async () => {
      expect(
        (await parseQuery({ ...range, includeTopProducts: 'false' }))
          .includeTopProducts,
      ).toBe(false);
    });

    it('rejects a grouping or a ranking it does not know', async () => {
      await expect(parseQuery({ ...range, groupBy: 'year' })).rejects.toThrow();
      await expect(
        parseQuery({ ...range, topProductsOrder: 'price' }),
      ).rejects.toThrow();
    });

    it('lists 10 products at most', async () => {
      expect(
        (await parseQuery({ ...range, topProductsLimit: '10' }))
          .topProductsLimit,
      ).toBe(10);
      await expect(
        parseQuery({ ...range, topProductsLimit: '11' }),
      ).rejects.toThrow();
    });

    it('rejects a business or a branch id passed in the query', async () => {
      await expect(
        parseQuery({ ...range, businessId: 'other' }),
      ).rejects.toThrow();
      await expect(
        parseQuery({ ...range, branchId: 'other' }),
      ).rejects.toThrow();
    });
  });

  describe('access', () => {
    const permissionsGuard = new PermissionsGuard(new Reflector());
    const featuresGuard = new FeaturesGuard(new Reflector());

    it('lets in a caller who can read analytics', () => {
      const context = contextFor(makeUser());

      expect(permissionsGuard.canActivate(context)).toBe(true);
      expect(featuresGuard.canActivate(context)).toBe(true);
    });

    it('rejects a caller without analytics.read, whatever else they can read', () => {
      const context = contextFor(
        makeUser({ permissions: ['dashboard.read', 'orders.read'] }),
      );

      expect(() => permissionsGuard.canActivate(context)).toThrow(
        UnauthorizedOperationException,
      );
    });

    it('rejects a business without the analytics module', () => {
      const context = contextFor(makeUser({ enabledFeatures: ['orders'] }));

      expect(() => featuresGuard.canActivate(context)).toThrow(
        UnauthorizedOperationException,
      );
    });
  });
});
