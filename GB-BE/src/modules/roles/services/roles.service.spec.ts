import {
  ConflictException,
  EntityNotFoundException,
} from '../../../common/exceptions';
import { RoleRow } from '../domain/role.interface';
import { RolesService } from './roles.service';

describe('RolesService', () => {
  let rolesRepository: {
    create: jest.Mock;
    findById: jest.Mock;
    findByName: jest.Mock;
    findAllByBusiness: jest.Mock;
    update: jest.Mock;
    getPermissionCodes: jest.Mock;
    replacePermissions: jest.Mock;
    countUsersWithRole: jest.Mock;
  };
  let permissionsRepository: { findAll: jest.Mock; findByCodes: jest.Mock };
  let transactionService: { execute: jest.Mock };
  let service: RolesService;
  const txClient = { tx: true };

  const businessId = 'business-1';

  function makeRole(overrides: Partial<RoleRow> = {}): RoleRow {
    return {
      id: 'role-1',
      business_id: businessId,
      name: 'MANAGER',
      description: null,
      created_at: new Date(),
      ...overrides,
    };
  }

  beforeEach(() => {
    rolesRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findByName: jest.fn(),
      findAllByBusiness: jest.fn(),
      update: jest.fn(),
      getPermissionCodes: jest.fn(),
      replacePermissions: jest.fn(),
      countUsersWithRole: jest.fn(),
    };
    permissionsRepository = { findAll: jest.fn(), findByCodes: jest.fn() };
    transactionService = {
      execute: jest.fn((work: (client: unknown) => Promise<unknown>) =>
        work(txClient),
      ),
    };
    service = new RolesService(
      rolesRepository,
      permissionsRepository,
      transactionService as never,
    );
  });

  describe('create', () => {
    it('creates a role when the name is free', async () => {
      rolesRepository.findByName.mockResolvedValue(null);
      rolesRepository.create.mockResolvedValue(makeRole());
      rolesRepository.getPermissionCodes.mockResolvedValue([]);

      const role = await service.create({ businessId, name: 'MANAGER' });

      expect(role.name).toBe('MANAGER');
      expect(role.permissions).toEqual([]);
      expect(rolesRepository.create).toHaveBeenCalledWith(
        { businessId, name: 'MANAGER' },
        txClient,
      );
      expect(permissionsRepository.findByCodes).not.toHaveBeenCalled();
      expect(rolesRepository.replacePermissions).not.toHaveBeenCalled();
    });

    it('grants the given permissions in the same transaction that creates the role', async () => {
      rolesRepository.findByName.mockResolvedValue(null);
      permissionsRepository.findByCodes.mockResolvedValue([
        { id: 'p1', code: 'orders.read' },
        { id: 'p2', code: 'orders.create' },
      ]);
      rolesRepository.create.mockResolvedValue(makeRole());
      rolesRepository.getPermissionCodes.mockResolvedValue([
        'orders.create',
        'orders.read',
      ]);

      const role = await service.create({ businessId, name: 'MANAGER' }, [
        'orders.read',
        'orders.create',
      ]);

      expect(rolesRepository.replacePermissions).toHaveBeenCalledWith(
        'role-1',
        ['p1', 'p2'],
        txClient,
      );
      expect(role.permissions).toEqual(['orders.create', 'orders.read']);
    });

    it('does not create the role when a permission code is unknown', async () => {
      rolesRepository.findByName.mockResolvedValue(null);
      permissionsRepository.findByCodes.mockResolvedValue([
        { id: 'p1', code: 'orders.read' },
      ]);

      await expect(
        service.create({ businessId, name: 'MANAGER' }, [
          'orders.read',
          'not.a.real.permission',
        ]),
      ).rejects.toThrow(EntityNotFoundException);
      expect(rolesRepository.create).not.toHaveBeenCalled();
    });

    it('rejects a duplicate role name within the same business', async () => {
      rolesRepository.findByName.mockResolvedValue(makeRole());

      await expect(
        service.create({ businessId, name: 'MANAGER' }),
      ).rejects.toThrow(ConflictException);
      expect(rolesRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('returns the role with its permission codes', async () => {
      rolesRepository.findById.mockResolvedValue(makeRole());
      rolesRepository.getPermissionCodes.mockResolvedValue(['orders.read']);

      const role = await service.findOne(businessId, 'role-1');

      expect(role.permissions).toEqual(['orders.read']);
    });

    it('throws EntityNotFoundException when the role does not belong to the business', async () => {
      rolesRepository.findById.mockResolvedValue(null);

      await expect(service.findOne(businessId, 'role-1')).rejects.toThrow(
        EntityNotFoundException,
      );
    });
  });

  describe('setPermissions', () => {
    it('replaces permissions when every code is a known permission', async () => {
      rolesRepository.findById.mockResolvedValue(makeRole());
      permissionsRepository.findByCodes.mockResolvedValue([
        { id: 'p1', code: 'orders.read' },
        { id: 'p2', code: 'orders.create' },
      ]);
      rolesRepository.getPermissionCodes.mockResolvedValue([
        'orders.create',
        'orders.read',
      ]);

      const result = await service.setPermissions(businessId, 'role-1', [
        'orders.read',
        'orders.create',
      ]);

      expect(rolesRepository.replacePermissions).toHaveBeenCalledWith(
        'role-1',
        ['p1', 'p2'],
      );
      expect(result).toEqual(['orders.create', 'orders.read']);
    });

    it('throws EntityNotFoundException when a permission code is unknown', async () => {
      rolesRepository.findById.mockResolvedValue(makeRole());
      permissionsRepository.findByCodes.mockResolvedValue([
        { id: 'p1', code: 'orders.read' },
      ]);

      await expect(
        service.setPermissions(businessId, 'role-1', [
          'orders.read',
          'not.a.real.permission',
        ]),
      ).rejects.toThrow(EntityNotFoundException);
      expect(rolesRepository.replacePermissions).not.toHaveBeenCalled();
    });
  });

  describe('provisionSystemRoles', () => {
    it('creates all 7 system roles and grants their default permissions', async () => {
      let counter = 0;
      rolesRepository.create.mockImplementation(() =>
        Promise.resolve(makeRole({ id: `role-${++counter}` })),
      );
      permissionsRepository.findByCodes.mockResolvedValue([
        { id: 'p1', code: 'orders.read' },
      ]);

      const client = {} as never;
      const rolesByName = await service.provisionSystemRoles(
        businessId,
        client,
      );

      expect(rolesRepository.create).toHaveBeenCalledTimes(7);
      expect(rolesRepository.replacePermissions).toHaveBeenCalledTimes(7);
      expect(rolesByName.size).toBe(7);
      expect(rolesByName.has('SUPER_ADMIN')).toBe(true);
      expect(rolesByName.has('EMPLOYEE')).toBe(true);
    });
  });
});
