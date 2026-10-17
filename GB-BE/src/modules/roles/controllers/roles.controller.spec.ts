import { RolesController } from './roles.controller';
import { RolesService } from '../services/roles.service';

describe('RolesController', () => {
  let service: jest.Mocked<
    Pick<
      RolesService,
      'create' | 'findAllForBusiness' | 'findOne' | 'update' | 'setPermissions'
    >
  >;
  let controller: RolesController;

  beforeEach(() => {
    service = {
      create: jest.fn(),
      findAllForBusiness: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      setPermissions: jest.fn(),
    };
    controller = new RolesController(service as unknown as RolesService);
  });

  it('create() scopes the new role to the current business', async () => {
    service.create.mockResolvedValue({ id: 'role-1' } as never);

    await controller.create('business-1', { name: 'SHIFT_LEAD' });

    expect(service.create).toHaveBeenCalledWith(
      { businessId: 'business-1', name: 'SHIFT_LEAD' },
      undefined,
    );
  });

  it('create() passes the initial permissions apart from the role data', async () => {
    service.create.mockResolvedValue({ id: 'role-1' } as never);

    await controller.create('business-1', {
      name: 'SHIFT_LEAD',
      permissionCodes: ['orders.read'],
    });

    expect(service.create).toHaveBeenCalledWith(
      { businessId: 'business-1', name: 'SHIFT_LEAD' },
      ['orders.read'],
    );
  });

  it('findAll() lists roles for the current business', async () => {
    service.findAllForBusiness.mockResolvedValue([]);

    await controller.findAll('business-1');

    expect(service.findAllForBusiness).toHaveBeenCalledWith('business-1');
  });

  it('findOne() looks up a single role', async () => {
    service.findOne.mockResolvedValue({ id: 'role-1' } as never);

    await controller.findOne('business-1', 'role-1');

    expect(service.findOne).toHaveBeenCalledWith('business-1', 'role-1');
  });

  it('update() delegates the patch', async () => {
    service.update.mockResolvedValue({ id: 'role-1' } as never);

    await controller.update('business-1', 'role-1', { description: 'Updated' });

    expect(service.update).toHaveBeenCalledWith('business-1', 'role-1', {
      description: 'Updated',
    });
  });

  it('setPermissions() replaces the permission set', async () => {
    service.setPermissions.mockResolvedValue(['orders.read']);

    await controller.setPermissions('business-1', 'role-1', {
      permissionCodes: ['orders.read'],
    });

    expect(service.setPermissions).toHaveBeenCalledWith(
      'business-1',
      'role-1',
      ['orders.read'],
    );
  });
});
