import { ProductsController } from './products.controller';
import { ProductsService } from '../services/products.service';

describe('ProductsController', () => {
  let service: jest.Mocked<
    Pick<
      ProductsService,
      | 'create'
      | 'findAll'
      | 'findAvailableForSale'
      | 'findOne'
      | 'getMargin'
      | 'update'
      | 'setActive'
      | 'setVisible'
      | 'softDelete'
    >
  >;
  let controller: ProductsController;

  beforeEach(() => {
    service = {
      create: jest.fn(),
      findAll: jest.fn(),
      findAvailableForSale: jest.fn(),
      findOne: jest.fn(),
      getMargin: jest.fn(),
      update: jest.fn(),
      setActive: jest.fn(),
      setVisible: jest.fn(),
      softDelete: jest.fn(),
    };
    controller = new ProductsController(
      service as unknown as ProductsService,
      {} as never,
    );
  });

  it('create() scopes to the current business', async () => {
    service.create.mockResolvedValue({ id: 'p1' } as never);
    await controller.create('business-1', 'actor-1', 'branch-1', {
      name: 'Burger',
    });
    expect(service.create).toHaveBeenCalledWith(
      { businessId: 'business-1', name: 'Burger', branchId: 'branch-1' },
      'actor-1',
    );
  });

  it('findAll() forwards filters', async () => {
    service.findAll.mockResolvedValue({ data: [], meta: {} } as never);
    await controller.findAll('business-1', {
      page: 1,
      limit: 20,
      sortOrder: 'DESC' as never,
      categoryId: 'cat-1',
      isActive: true,
      isVisible: true,
      search: 'burger',
    });
    expect(service.findAll).toHaveBeenCalledWith({
      businessId: 'business-1',
      page: 1,
      limit: 20,
      categoryId: 'cat-1',
      isActive: true,
      isVisible: true,
      search: 'burger',
    });
  });

  it('findAvailableForSale() delegates', async () => {
    service.findAvailableForSale.mockResolvedValue([]);
    await controller.findAvailableForSale('business-1');
    expect(service.findAvailableForSale).toHaveBeenCalledWith('business-1');
  });

  it('findOne() delegates', async () => {
    service.findOne.mockResolvedValue({ id: 'p1' } as never);
    await controller.findOne('business-1', 'p1');
    expect(service.findOne).toHaveBeenCalledWith('business-1', 'p1');
  });

  it('getMargin() delegates', async () => {
    service.getMargin.mockResolvedValue({
      salePrice: 1,
      currentCost: 0,
      marginAmount: 1,
      marginPercent: 100,
    });
    await controller.getMargin('business-1', 'p1');
    expect(service.getMargin).toHaveBeenCalledWith('business-1', 'p1');
  });

  it('update() delegates with actor', async () => {
    service.update.mockResolvedValue({ id: 'p1' } as never);
    await controller.update('business-1', 'actor-1', 'p1', { name: 'New' });
    expect(service.update).toHaveBeenCalledWith(
      'business-1',
      'p1',
      { name: 'New' },
      'actor-1',
    );
  });

  it('setStatus() delegates', async () => {
    service.setActive.mockResolvedValue({ id: 'p1' } as never);
    await controller.setStatus('business-1', 'actor-1', 'p1', {
      isActive: false,
    });
    expect(service.setActive).toHaveBeenCalledWith(
      'business-1',
      'p1',
      false,
      'actor-1',
    );
  });

  it('setVisibility() delegates', async () => {
    service.setVisible.mockResolvedValue({ id: 'p1' } as never);
    await controller.setVisibility('business-1', 'actor-1', 'p1', {
      isVisible: false,
    });
    expect(service.setVisible).toHaveBeenCalledWith(
      'business-1',
      'p1',
      false,
      'actor-1',
    );
  });

  it('remove() soft-deletes', async () => {
    service.softDelete.mockResolvedValue(undefined);
    await controller.remove('business-1', 'actor-1', 'p1');
    expect(service.softDelete).toHaveBeenCalledWith(
      'business-1',
      'p1',
      'actor-1',
    );
  });
});
