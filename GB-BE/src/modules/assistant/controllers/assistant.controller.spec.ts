import { ExecutionContext, ValidationPipe } from '@nestjs/common';
import { PATH_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { UnauthorizedOperationException } from '../../../common/exceptions';
import { FeaturesGuard } from '../../../common/guards/features.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { AuthenticatedUser } from '../../../common/interfaces/authenticated-user.interface';
import { AssistantProductsQueryDto } from '../dto/assistant-products-query.dto';
import { AssistantProductsService } from '../services/assistant-products.service';
import { AssistantSalesService } from '../services/assistant-sales.service';
import { AssistantService } from '../services/assistant.service';
import { AssistantController } from './assistant.controller';

describe('AssistantController', () => {
  let productsService: jest.Mocked<Pick<AssistantProductsService, 'search'>>;
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
      permissions: ['products.read', 'inventory.read'],
      isPlatformAdmin: false,
      enabledFeatures: ['products', 'inventory'],
      mustChangePassword: false,
      ...overrides,
    };
  }

  /** The request as the guards see it: this handler, called by this user. */
  function contextFor(user: AuthenticatedUser): ExecutionContext {
    return {
      // eslint-disable-next-line @typescript-eslint/unbound-method -- the guards only read its metadata
      getHandler: () => AssistantController.prototype.findProducts,
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
      metatype: AssistantProductsQueryDto,
    }) as Promise<AssistantProductsQueryDto>;
  }

  beforeEach(() => {
    productsService = { search: jest.fn() };
    controller = new AssistantController(
      new AssistantService(),
      productsService as unknown as AssistantProductsService,
      {} as AssistantSalesService,
    );
  });

  it('serves its endpoints under /assistant', () => {
    expect(Reflect.getMetadata(PATH_METADATA, AssistantController)).toBe(
      'assistant',
    );
  });

  describe('findProducts()', () => {
    it('takes the business and the branch from the session, never from the query', async () => {
      const query = await parseQuery({ search: '  Agua Manantial  ' });

      await controller.findProducts('business-1', makeUser(), query);

      expect(productsService.search).toHaveBeenCalledWith({
        businessId: 'business-1',
        branchId: 'branch-1',
        canReadStock: true,
        search: 'Agua Manantial',
        isActive: undefined,
        isVisible: undefined,
        limit: 10,
        sortBy: 'name',
        sortOrder: 'asc',
      });
    });

    it('withholds stock from a caller without the inventory permission', async () => {
      await controller.findProducts(
        'business-1',
        makeUser({ permissions: ['products.read'] }),
        await parseQuery({}),
      );

      expect(productsService.search).toHaveBeenCalledWith(
        expect.objectContaining({ canReadStock: false }),
      );
    });

    it('withholds stock when the business does not have the inventory module', async () => {
      await controller.findProducts(
        'business-1',
        makeUser({ enabledFeatures: ['products'] }),
        await parseQuery({}),
      );

      expect(productsService.search).toHaveBeenCalledWith(
        expect.objectContaining({ canReadStock: false }),
      );
    });
  });

  describe('access', () => {
    const permissionsGuard = new PermissionsGuard(new Reflector());
    const featuresGuard = new FeaturesGuard(new Reflector());

    it('lets in a caller who can read products', () => {
      const context = contextFor(makeUser({ permissions: ['products.read'] }));

      expect(permissionsGuard.canActivate(context)).toBe(true);
      expect(featuresGuard.canActivate(context)).toBe(true);
    });

    it('rejects a caller who cannot read products, even one who can read inventory', () => {
      const context = contextFor(makeUser({ permissions: ['inventory.read'] }));

      expect(() => permissionsGuard.canActivate(context)).toThrow(
        UnauthorizedOperationException,
      );
    });

    it('rejects a business without the products module', () => {
      const context = contextFor(makeUser({ enabledFeatures: ['inventory'] }));

      expect(() => featuresGuard.canActivate(context)).toThrow(
        UnauthorizedOperationException,
      );
    });
  });

  describe('query', () => {
    it('defaults the limit to 10 and leaves the filters unset', async () => {
      const query = await parseQuery({});

      expect(query.limit).toBe(10);
      expect(query.isActive).toBeUndefined();
      expect(query.isVisible).toBeUndefined();
    });

    it('reads isActive and isVisible as sent — "false" is false', async () => {
      const query = await parseQuery({ isActive: 'false', isVisible: 'true' });

      expect(query.isActive).toBe(false);
      expect(query.isVisible).toBe(true);
    });

    it('accepts a limit up to 20 and rejects more', async () => {
      expect((await parseQuery({ limit: '20' })).limit).toBe(20);
      await expect(parseQuery({ limit: '21' })).rejects.toThrow();
      await expect(parseQuery({ limit: '0' })).rejects.toThrow();
    });

    it('rejects a flag that is not a boolean', async () => {
      await expect(parseQuery({ isActive: 'quizas' })).rejects.toThrow();
    });

    it('orders by name unless asked to order by stock', async () => {
      const byDefault = await parseQuery({});
      expect(byDefault.sortBy).toBe('name');
      expect(byDefault.sortOrder).toBe('asc');

      const byStock = await parseQuery({ sortBy: 'stock', sortOrder: 'desc' });
      await controller.findProducts('business-1', makeUser(), byStock);
      expect(productsService.search).toHaveBeenCalledWith(
        expect.objectContaining({ sortBy: 'stock', sortOrder: 'desc' }),
      );
    });

    it('rejects an ordering it does not know', async () => {
      await expect(parseQuery({ sortBy: 'price' })).rejects.toThrow();
      await expect(parseQuery({ sortOrder: 'up' })).rejects.toThrow();
    });

    it('rejects a business, branch or inventory item passed in the query', async () => {
      await expect(parseQuery({ businessId: 'other' })).rejects.toThrow();
      await expect(parseQuery({ branchId: 'other' })).rejects.toThrow();
      await expect(parseQuery({ inventoryItemId: 'other' })).rejects.toThrow();
    });
  });
});
