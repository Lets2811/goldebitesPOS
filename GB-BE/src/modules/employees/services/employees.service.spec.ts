import {
  BusinessRuleException,
  ConflictException,
  EntityNotFoundException,
} from '../../../common/exceptions';
import { DEFAULT_EMPLOYEE_PASSWORD } from '../../../common/constants/default-password.constant';
import { UserStatus } from '../../users/domain/user.types';
import { DEFAULT_EMPLOYEE_SHIFTS } from '../domain/default-shifts.constant';
import { EmployeePayFrequency } from '../domain/employee.types';
import { EmployeeRow, EmployeeShiftRow } from '../domain/employee.interface';
import { EmployeesService } from './employees.service';

describe('EmployeesService', () => {
  let employeesRepository: {
    create: jest.Mock;
    findById: jest.Mock;
    findByUserId: jest.Mock;
    findByDocumentNumber: jest.Mock;
    findAll: jest.Mock;
    update: jest.Mock;
    updatePayFrequency: jest.Mock;
    setStatus: jest.Mock;
    softDelete: jest.Mock;
    setUserId: jest.Mock;
    findShifts: jest.Mock;
    replaceShifts: jest.Mock;
  };
  let usersService: {
    create: jest.Mock;
    generateUniqueLoginEmail: jest.Mock;
    setPasswordHash: jest.Mock;
    setStatus: jest.Mock;
    findRawById: jest.Mock;
  };
  let transactionService: { execute: jest.Mock };
  let auditService: { record: jest.Mock };
  let branchesService: { findOne: jest.Mock };
  let service: EmployeesService;

  const businessId = 'business-1';
  const branchId = 'branch-1';
  const actorUserId = 'actor-1';

  function makeEmployeeRow(overrides: Partial<EmployeeRow> = {}): EmployeeRow {
    return {
      id: 'employee-1',
      business_id: businessId,
      branch_id: branchId,
      role_id: 'role-1',
      user_id: null,
      first_name: 'Juan',
      last_name: 'Perez',
      document_type: null,
      document_number: null,
      phone: null,
      email: null,
      position: null,
      status: 'ACTIVE' as EmployeeRow['status'],
      hire_date: null,
      notes: null,
      pay_rate: null,
      pay_frequency: null,
      created_at: new Date(),
      updated_at: new Date(),
      deleted_at: null,
      ...overrides,
    };
  }

  function makeShiftRow(overrides: Partial<EmployeeShiftRow> = {}): EmployeeShiftRow {
    return {
      id: 'shift-1',
      employee_id: 'employee-1',
      day_of_week: 1,
      start_time: '15:00',
      end_time: '22:00',
      branch_id: null,
      ...overrides,
    };
  }

  function makeCreatedUser(overrides: Partial<{ id: string; email: string; status: UserStatus }> = {}) {
    return {
      id: 'user-1',
      businessId,
      branchId,
      roleId: 'role-1',
      firstName: 'Juan',
      lastName: 'Perez',
      email: 'jupe1@personal.local',
      phone: null,
      status: UserStatus.ACTIVE,
      lastLoginAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  beforeEach(() => {
    employeesRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findByUserId: jest.fn(),
      findByDocumentNumber: jest.fn().mockResolvedValue(null),
      findAll: jest.fn(),
      update: jest.fn(),
      updatePayFrequency: jest.fn(),
      setStatus: jest.fn(),
      softDelete: jest.fn(),
      setUserId: jest.fn(),
      findShifts: jest.fn().mockResolvedValue([]),
      replaceShifts: jest.fn(),
    };
    usersService = {
      create: jest.fn(),
      generateUniqueLoginEmail: jest.fn(),
      setPasswordHash: jest.fn(),
      setStatus: jest.fn(),
      findRawById: jest.fn(),
    };
    transactionService = {
      execute: jest.fn((fn: (client: unknown) => unknown) => fn(undefined)),
    };
    auditService = { record: jest.fn() };
    branchesService = { findOne: jest.fn() };
    service = new EmployeesService(
      employeesRepository as never,
      usersService as never,
      transactionService as never,
      auditService as never,
      branchesService as never,
    );
  });

  describe('create', () => {
    it('auto-provisions a login account with a generated handle and the fixed default password', async () => {
      usersService.generateUniqueLoginEmail.mockResolvedValue('jupe1@personal.local');
      employeesRepository.create.mockResolvedValue(makeEmployeeRow());
      const createdUser = makeCreatedUser();
      usersService.create.mockResolvedValue(createdUser);
      employeesRepository.setUserId.mockResolvedValue(
        makeEmployeeRow({ user_id: createdUser.id }),
      );

      const result = await service.create(
        {
          businessId,
          branchId,
          roleId: 'role-1',
          firstName: 'Juan',
          lastName: 'Perez',
        },
        actorUserId,
      );

      expect(usersService.generateUniqueLoginEmail).toHaveBeenCalledWith(
        businessId,
        'Juan',
        'Perez',
      );
      expect(usersService.create).toHaveBeenCalledWith(
        businessId,
        expect.objectContaining({
          email: 'jupe1@personal.local',
          password: DEFAULT_EMPLOYEE_PASSWORD,
          roleId: 'role-1',
          mustChangePassword: true,
        }),
        actorUserId,
        undefined,
      );
      expect(employeesRepository.setUserId).toHaveBeenCalledWith(
        'employee-1',
        businessId,
        createdUser.id,
        undefined,
      );
      expect(employeesRepository.replaceShifts).toHaveBeenCalledWith(
        'employee-1',
        DEFAULT_EMPLOYEE_SHIFTS,
        undefined,
      );
      expect(result.userAccount).toEqual({
        id: createdUser.id,
        email: 'jupe1@personal.local',
        status: UserStatus.ACTIVE,
      });
      expect(transactionService.execute).toHaveBeenCalled();
    });

    it('records an audit entry including the generated login email', async () => {
      usersService.generateUniqueLoginEmail.mockResolvedValue('jupe1@personal.local');
      employeesRepository.create.mockResolvedValue(makeEmployeeRow());
      usersService.create.mockResolvedValue(makeCreatedUser());
      employeesRepository.setUserId.mockResolvedValue(makeEmployeeRow({ user_id: 'user-1' }));

      await service.create(
        { businessId, branchId, roleId: 'role-1', firstName: 'Juan', lastName: 'Perez' },
        actorUserId,
      );

      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'employee',
          action: 'CREATE',
          newValues: expect.objectContaining({ loginEmail: 'jupe1@personal.local' }),
        }),
      );
    });

    it('registers the employee without a login account when createAccess is false', async () => {
      employeesRepository.create.mockResolvedValue(makeEmployeeRow());

      const result = await service.create(
        {
          businessId,
          branchId,
          roleId: 'role-1',
          firstName: 'Juan',
          lastName: 'Perez',
          createAccess: false,
        },
        actorUserId,
      );

      expect(usersService.create).not.toHaveBeenCalled();
      expect(employeesRepository.setUserId).not.toHaveBeenCalled();
      expect(employeesRepository.create).toHaveBeenCalledWith(
        expect.not.objectContaining({ createAccess: expect.anything() }),
        undefined,
      );
      expect(employeesRepository.replaceShifts).toHaveBeenCalledWith(
        'employee-1',
        DEFAULT_EMPLOYEE_SHIFTS,
        undefined,
      );
      expect(result.userAccount).toBeNull();
    });

    it('rejects a document number another employee already has', async () => {
      employeesRepository.findByDocumentNumber.mockResolvedValue(
        makeEmployeeRow({ id: 'employee-2', document_number: '1020304050' }),
      );

      await expect(
        service.create(
          {
            businessId,
            roleId: 'role-1',
            firstName: 'Juan',
            lastName: 'Perez',
            documentNumber: '1020304050',
          },
          actorUserId,
        ),
      ).rejects.toThrow(ConflictException);
      expect(employeesRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('lets an employee keep their own document number', async () => {
      employeesRepository.findById.mockResolvedValue(makeEmployeeRow());
      employeesRepository.findByDocumentNumber.mockResolvedValue(
        makeEmployeeRow({ document_number: '1020304050' }),
      );
      employeesRepository.update.mockResolvedValue(
        makeEmployeeRow({ document_number: '1020304050' }),
      );

      const result = await service.update(businessId, 'employee-1', {
        documentNumber: '1020304050',
      });

      expect(result.documentNumber).toBe('1020304050');
    });
  });

  describe('replaceShifts', () => {
    it('checks that every shift branch belongs to the business', async () => {
      employeesRepository.findById.mockResolvedValue(makeEmployeeRow());
      employeesRepository.replaceShifts.mockResolvedValue([
        makeShiftRow({ branch_id: 'branch-2' }),
      ]);
      branchesService.findOne.mockRejectedValue(
        new EntityNotFoundException('Branch', 'branch-2'),
      );

      await expect(
        service.replaceShifts(businessId, 'employee-1', [
          { dayOfWeek: 1, startTime: '08:00', endTime: '16:00', branchId: 'branch-2' },
        ]),
      ).rejects.toThrow(EntityNotFoundException);
      expect(employeesRepository.replaceShifts).not.toHaveBeenCalled();
    });

    it('saves the branch of each shift', async () => {
      employeesRepository.findById.mockResolvedValue(makeEmployeeRow());
      employeesRepository.replaceShifts.mockResolvedValue([
        makeShiftRow({ branch_id: 'branch-2' }),
      ]);

      const result = await service.replaceShifts(businessId, 'employee-1', [
        { dayOfWeek: 1, startTime: '08:00', endTime: '16:00', branchId: 'branch-2' },
      ]);

      expect(branchesService.findOne).toHaveBeenCalledWith(businessId, 'branch-2');
      expect(result.shifts[0].branchId).toBe('branch-2');
    });
  });

  describe('generateCredentials', () => {
    it('throws when the employee already has credentials', async () => {
      employeesRepository.findById.mockResolvedValue(
        makeEmployeeRow({ user_id: 'existing-user' }),
      );

      await expect(
        service.generateCredentials(businessId, 'employee-1', { roleId: 'role-1' }),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('auto-generates a login email and uses the fixed default password for a legacy employee', async () => {
      employeesRepository.findById.mockResolvedValue(makeEmployeeRow());
      usersService.generateUniqueLoginEmail.mockResolvedValue('jupe1@personal.local');
      const createdUser = makeCreatedUser();
      usersService.create.mockResolvedValue(createdUser);
      employeesRepository.setUserId.mockResolvedValue(
        makeEmployeeRow({ user_id: createdUser.id }),
      );

      const result = await service.generateCredentials(businessId, 'employee-1', {
        roleId: 'role-1',
      });

      expect(usersService.create).toHaveBeenCalledWith(
        businessId,
        expect.objectContaining({
          email: 'jupe1@personal.local',
          password: DEFAULT_EMPLOYEE_PASSWORD,
          mustChangePassword: true,
        }),
        undefined,
      );
      expect(result.userAccount?.email).toBe('jupe1@personal.local');
    });
  });

  describe('resetCredentials', () => {
    it('throws when the employee has no login credentials', async () => {
      employeesRepository.findById.mockResolvedValue(makeEmployeeRow({ user_id: null }));

      await expect(service.resetCredentials(businessId, 'employee-1')).rejects.toThrow(
        BusinessRuleException,
      );
    });

    it('generates a random one-time password and forces a change on next login', async () => {
      employeesRepository.findById.mockResolvedValue(
        makeEmployeeRow({ user_id: 'user-1' }),
      );

      const result = await service.resetCredentials(businessId, 'employee-1', actorUserId);

      expect(usersService.setPasswordHash).toHaveBeenCalledWith(
        'user-1',
        result.temporaryPassword,
        true,
      );
      expect(result.temporaryPassword).toEqual(expect.any(String));
    });
  });

  describe('findMyShifts', () => {
    it('returns null when the caller has no linked employee record', async () => {
      employeesRepository.findByUserId.mockResolvedValue(null);

      const result = await service.findMyShifts(businessId, 'user-1');

      expect(result).toBeNull();
      expect(employeesRepository.findShifts).not.toHaveBeenCalled();
    });

    it("returns the caller's own shifts, resolved via their linked employee record", async () => {
      employeesRepository.findByUserId.mockResolvedValue(makeEmployeeRow({ user_id: 'user-1' }));
      employeesRepository.findShifts.mockResolvedValue([makeShiftRow()]);

      const result = await service.findMyShifts(businessId, 'user-1');

      expect(employeesRepository.findByUserId).toHaveBeenCalledWith(businessId, 'user-1');
      expect(employeesRepository.findShifts).toHaveBeenCalledWith('employee-1');
      expect(result).toHaveLength(1);
      expect(result?.[0].dayOfWeek).toBe(1);
    });
  });

  describe('replaceMyShifts', () => {
    it('throws when the caller has no linked employee record', async () => {
      employeesRepository.findByUserId.mockResolvedValue(null);

      await expect(
        service.replaceMyShifts(businessId, 'user-1', [{ dayOfWeek: 1, startTime: '09:00', endTime: '17:00' }]),
      ).rejects.toThrow(EntityNotFoundException);
    });

    it("replaces the caller's own shifts via the same path an admin uses", async () => {
      employeesRepository.findByUserId.mockResolvedValue(makeEmployeeRow({ user_id: 'user-1' }));
      employeesRepository.findById.mockResolvedValue(makeEmployeeRow({ user_id: 'user-1' }));
      employeesRepository.replaceShifts.mockResolvedValue([
        makeShiftRow({ start_time: '09:00', end_time: '17:00' }),
      ]);

      const shifts = [{ dayOfWeek: 1, startTime: '09:00', endTime: '17:00' }];
      const result = await service.replaceMyShifts(businessId, 'user-1', shifts);

      expect(employeesRepository.replaceShifts).toHaveBeenCalledWith('employee-1', shifts, undefined);
      expect(result).toHaveLength(1);
      expect(result[0].startTime).toBe('09:00');
    });
  });

  describe('findMyPayroll', () => {
    it('returns null when the caller has no linked employee record', async () => {
      employeesRepository.findByUserId.mockResolvedValue(null);

      expect(await service.findMyPayroll(businessId, 'user-1')).toBeNull();
    });

    it("returns the caller's own payRate and payFrequency, resolved via their linked employee record", async () => {
      employeesRepository.findByUserId.mockResolvedValue(
        makeEmployeeRow({ user_id: 'user-1', pay_rate: '150000', pay_frequency: EmployeePayFrequency.WEEK }),
      );

      const result = await service.findMyPayroll(businessId, 'user-1');

      expect(employeesRepository.findByUserId).toHaveBeenCalledWith(businessId, 'user-1');
      expect(result).toEqual({ payRate: 150000, payFrequency: EmployeePayFrequency.WEEK });
    });
  });

  describe('updateMyPayFrequency', () => {
    it('throws when the caller has no linked employee record', async () => {
      employeesRepository.findByUserId.mockResolvedValue(null);

      await expect(
        service.updateMyPayFrequency(businessId, 'user-1', EmployeePayFrequency.BIWEEKLY),
      ).rejects.toThrow(EntityNotFoundException);
    });

    it('updates only pay_frequency via the narrow repository method, never touching pay_rate', async () => {
      employeesRepository.findByUserId.mockResolvedValue(makeEmployeeRow({ user_id: 'user-1' }));
      employeesRepository.updatePayFrequency.mockResolvedValue(
        makeEmployeeRow({
          user_id: 'user-1',
          pay_rate: '150000',
          pay_frequency: EmployeePayFrequency.BIWEEKLY,
        }),
      );

      const result = await service.updateMyPayFrequency(
        businessId,
        'user-1',
        EmployeePayFrequency.BIWEEKLY,
      );

      expect(employeesRepository.updatePayFrequency).toHaveBeenCalledWith(
        'employee-1',
        businessId,
        EmployeePayFrequency.BIWEEKLY,
        undefined,
      );
      expect(result).toEqual({ payRate: 150000, payFrequency: EmployeePayFrequency.BIWEEKLY });
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'employee',
          action: 'UPDATE_PAY_FREQUENCY',
          newValues: { payFrequency: EmployeePayFrequency.BIWEEKLY },
        }),
      );
    });
  });
});
