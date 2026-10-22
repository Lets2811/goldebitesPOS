import { InventoryItemsController } from './inventory-items.controller';
import { InventoryItemsService } from '../services/inventory-items.service';

describe('InventoryItemsController', () => {
  let service: jest.Mocked<
    Pick<
      InventoryItemsService,
      'create' | 'findAll' | 'findOne' | 'update' | 'setActive' | 'softDelete'
    >
  >;
  let controller: InventoryItemsController;

  beforeEach(() => {
    service = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      setActive: jest.fn(),
      softDelete: jest.fn(),
    };
    controller = new InventoryItemsController(
      service as unknown as InventoryItemsService,
    );
  });

  it('create() scopes to the current business', async () => {
    service.create.mockResolvedValue({ id: 'item-1' } as never);
    await controller.create('business-1', 'actor-1', 'branch-1', {
      name: 'Flour',
      unit: 'kg',
    });
    expect(service.create).toHaveBeenCalledWith(
      {
        businessId: 'business-1',
        name: 'Flour',
        unit: 'kg',
        branchId: 'branch-1',
      },
      'actor-1',
    );
  });

  it('findAll() forwards filters', async () => {
    service.findAll.mockResolvedValue({ data: [], meta: {} } as never);
    await controller.findAll('business-1', {
      page: 1,
      limit: 20,
      sortOrder: 'DESC' as never,
      isActive: true,
      search: 'flour',
    });
    expect(service.findAll).toHaveBeenCalledWith({
      businessId: 'business-1',
      page: 1,
      limit: 20,
      isActive: true,
      search: 'flour',
    });
  });

  it('findOne() delegates', async () => {
    service.findOne.mockResolvedValue({ id: 'item-1' } as never);
    await controller.findOne('business-1', 'item-1');
    expect(service.findOne).toHaveBeenCalledWith('business-1', 'item-1');
  });

  it('update() delegates with actor', async () => {
    service.update.mockResolvedValue({ id: 'item-1' } as never);
    await controller.update('business-1', 'actor-1', 'item-1', { name: 'New' });
    expect(service.update).toHaveBeenCalledWith(
      'business-1',
      'item-1',
      { name: 'New' },
      'actor-1',
    );
  });

  it('setStatus() delegates', async () => {
    service.setActive.mockResolvedValue({ id: 'item-1' } as never);
    await controller.setStatus('business-1', 'actor-1', 'item-1', {
      isActive: false,
    });
    expect(service.setActive).toHaveBeenCalledWith(
      'business-1',
      'item-1',
      false,
      'actor-1',
    );
  });

  it('remove() soft-deletes', async () => {
    service.softDelete.mockResolvedValue(undefined);
    await controller.remove('business-1', 'actor-1', 'item-1');
    expect(service.softDelete).toHaveBeenCalledWith(
      'business-1',
      'item-1',
      'actor-1',
    );
  });
});
