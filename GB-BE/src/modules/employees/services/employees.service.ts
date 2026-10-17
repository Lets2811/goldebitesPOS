import { Inject, Injectable } from '@nestjs/common';
import {
  BusinessRuleException,
  ConflictException,
  EntityNotFoundException,
} from '../../../common/exceptions';
import { DEFAULT_EMPLOYEE_PASSWORD } from '../../../common/constants/default-password.constant';
import { PaginatedResult } from '../../../common/pagination/paginated-result.interface';
import { buildPaginationMeta } from '../../../common/pagination/pagination.util';
import { generateTemporaryPassword } from '../../../common/utils/generate-password.util';
import { TransactionService } from '../../../database/transaction.service';
import { AuditService } from '../../audit/services/audit.service';
import { BranchesService } from '../../branches/services/branches.service';
import { UserStatus } from '../../users/domain/user.types';
import { UsersService } from '../../users/services/users.service';
import { DEFAULT_EMPLOYEE_SHIFTS } from '../domain/default-shifts.constant';
import {
  Employee,
  EmployeePayroll,
  EmployeeRow,
  EmployeeShift,
  EmployeeUserAccount,
  EmployeeWithShifts,
} from '../domain/employee.interface';
import {
  CreateEmployeeData,
  EmployeePayFrequency,
  EmployeeQuery,
  EmployeeStatus,
  ShiftInput,
  UpdateEmployeeData,
} from '../domain/employee.types';
import { EmployeeMapper } from '../mappers/employee.mapper';
import { EMPLOYEES_REPOSITORY } from '../repositories/employees.repository.interface';
import type { IEmployeesRepository } from '../repositories/employees.repository.interface';

export interface GenerateEmployeeCredentialsInput {
  roleId: string;
  branchId?: string;
}

@Injectable()
export class EmployeesService {
  constructor(
    @Inject(EMPLOYEES_REPOSITORY)
    private readonly employeesRepository: IEmployeesRepository,
    private readonly usersService: UsersService,
    private readonly transactionService: TransactionService,
    private readonly auditService: AuditService,
    private readonly branchesService: BranchesService,
  ) {}

  /**
   * A new employee gets a login account automatically — an auto-generated
   * handle (e.g. "jupe1@personal.local") plus the fixed default password,
   * forced to change on first login — unless `createAccess` is false: then
   * they're registered without one, and generateCredentials() can add it later.
   */
  async create(
    data: CreateEmployeeData,
    actorUserId?: string,
  ): Promise<EmployeeWithShifts> {
    const { createAccess = true, ...employeeData } = data;
    await this.assertDocumentAvailable(data.businessId, data.documentNumber);

    if (!createAccess) {
      return this.createWithoutAccess(employeeData, actorUserId);
    }

    const loginEmail = await this.usersService.generateUniqueLoginEmail(
      data.businessId,
      data.firstName,
      data.lastName,
    );

    const { employeeRow, user } = await this.transactionService.execute(
      async (client) => {
        const created = await this.employeesRepository.create(employeeData, client);
        const user = await this.usersService.create(
          data.businessId,
          {
            firstName: data.firstName,
            lastName: data.lastName,
            email: loginEmail,
            password: DEFAULT_EMPLOYEE_PASSWORD,
            roleId: data.roleId,
            branchId: data.branchId,
            phone: data.phone,
            mustChangePassword: true,
          },
          actorUserId,
          client,
        );
        const linked = await this.employeesRepository.setUserId(
          created.id,
          data.businessId,
          user.id,
          client,
        );
        await this.employeesRepository.replaceShifts(
          created.id,
          DEFAULT_EMPLOYEE_SHIFTS,
          client,
        );
        return { employeeRow: linked ?? created, user };
      },
    );

    await this.auditService.record({
      businessId: data.businessId,
      branchId: data.branchId,
      userId: actorUserId,
      entityType: 'employee',
      entityId: employeeRow.id,
      action: 'CREATE',
      newValues: {
        firstName: employeeRow.first_name,
        lastName: employeeRow.last_name,
        loginEmail,
      },
    });

    const shiftRows = await this.employeesRepository.findShifts(employeeRow.id);
    return {
      ...EmployeeMapper.toDomain(employeeRow),
      shifts: shiftRows.map((shift) => EmployeeMapper.shiftToDomain(shift)),
      userAccount: { id: user.id, email: user.email, status: user.status },
    };
  }

  private async createWithoutAccess(
    data: CreateEmployeeData,
    actorUserId?: string,
  ): Promise<EmployeeWithShifts> {
    const employeeRow = await this.transactionService.execute(async (client) => {
      const created = await this.employeesRepository.create(data, client);
      await this.employeesRepository.replaceShifts(
        created.id,
        DEFAULT_EMPLOYEE_SHIFTS,
        client,
      );
      return created;
    });

    await this.auditService.record({
      businessId: data.businessId,
      branchId: data.branchId,
      userId: actorUserId,
      entityType: 'employee',
      entityId: employeeRow.id,
      action: 'CREATE',
      newValues: {
        firstName: employeeRow.first_name,
        lastName: employeeRow.last_name,
        withoutAccess: true,
      },
    });

    const shiftRows = await this.employeesRepository.findShifts(employeeRow.id);
    return {
      ...EmployeeMapper.toDomain(employeeRow),
      shifts: shiftRows.map((shift) => EmployeeMapper.shiftToDomain(shift)),
      userAccount: null,
    };
  }

  async findAll(query: EmployeeQuery): Promise<PaginatedResult<Employee>> {
    const { rows, total } = await this.employeesRepository.findAll(query);
    return {
      data: rows.map((row) => EmployeeMapper.toDomain(row)),
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  async findOne(businessId: string, id: string): Promise<EmployeeWithShifts> {
    const row = await this.getOwnedOrFail(businessId, id);
    const shiftRows = await this.employeesRepository.findShifts(id);
    const userAccount = await this.loadUserAccount(businessId, row.user_id);
    return {
      ...EmployeeMapper.toDomain(row),
      shifts: shiftRows.map((shift) => EmployeeMapper.shiftToDomain(shift)),
      userAccount,
    };
  }

  async update(
    businessId: string,
    id: string,
    data: UpdateEmployeeData,
    actorUserId?: string,
  ): Promise<Employee> {
    await this.getOwnedOrFail(businessId, id);
    await this.assertDocumentAvailable(businessId, data.documentNumber, id);
    const row = await this.employeesRepository.update(id, businessId, data);
    if (!row) {
      throw new EntityNotFoundException('Employee', id);
    }
    await this.auditService.record({
      businessId,
      userId: actorUserId,
      entityType: 'employee',
      entityId: id,
      action: 'UPDATE',
      newValues: data as Record<string, unknown>,
    });
    return EmployeeMapper.toDomain(row);
  }

  async setStatus(
    businessId: string,
    id: string,
    status: EmployeeStatus,
    actorUserId?: string,
  ): Promise<Employee> {
    await this.getOwnedOrFail(businessId, id);
    const row = await this.employeesRepository.setStatus(
      id,
      businessId,
      status,
    );
    if (!row) {
      throw new EntityNotFoundException('Employee', id);
    }
    await this.auditService.record({
      businessId,
      userId: actorUserId,
      entityType: 'employee',
      entityId: id,
      action: `STATUS_${status}`,
    });
    return EmployeeMapper.toDomain(row);
  }

  async softDelete(
    businessId: string,
    id: string,
    actorUserId?: string,
  ): Promise<void> {
    await this.getOwnedOrFail(businessId, id);
    const row = await this.employeesRepository.softDelete(id, businessId);
    if (!row) {
      throw new EntityNotFoundException('Employee', id);
    }
    await this.auditService.record({
      businessId,
      userId: actorUserId,
      entityType: 'employee',
      entityId: id,
      action: 'DELETE',
    });
  }

  async replaceShifts(
    businessId: string,
    id: string,
    shifts: ShiftInput[],
    actorUserId?: string,
  ): Promise<EmployeeWithShifts> {
    const row = await this.getOwnedOrFail(businessId, id);
    await this.assertShiftBranchesOwned(businessId, shifts);
    const shiftRows = await this.transactionService.execute((client) =>
      this.employeesRepository.replaceShifts(id, shifts, client),
    );

    await this.auditService.record({
      businessId,
      userId: actorUserId,
      entityType: 'employee',
      entityId: id,
      action: 'UPDATE_SHIFTS',
      newValues: { shiftCount: shifts.length },
    });

    const userAccount = await this.loadUserAccount(businessId, row.user_id);
    return {
      ...EmployeeMapper.toDomain(row),
      shifts: shiftRows.map((shift) => EmployeeMapper.shiftToDomain(shift)),
      userAccount,
    };
  }

  /**
   * Self-service: the caller's own weekly schedule, resolved from their JWT
   * userId via the employees.user_id link. Returns null (not an error) when
   * this user has no linked employee record — e.g. an owner/admin account
   * created directly, never through the employee flow — so the profile page
   * can render a clean "not applicable" state instead of an error.
   */
  async findMyShifts(businessId: string, userId: string): Promise<EmployeeShift[] | null> {
    const employee = await this.employeesRepository.findByUserId(businessId, userId);
    if (!employee) return null;
    const shiftRows = await this.employeesRepository.findShifts(employee.id);
    return shiftRows.map((shift) => EmployeeMapper.shiftToDomain(shift));
  }

  /** Self-service: lets an employee adjust their own schedule around the default — same replaceShifts() an admin uses, just resolved from their own JWT instead of a route param. */
  async replaceMyShifts(
    businessId: string,
    userId: string,
    shifts: ShiftInput[],
  ): Promise<EmployeeShift[]> {
    const employee = await this.employeesRepository.findByUserId(businessId, userId);
    if (!employee) {
      throw new EntityNotFoundException('Employee', userId);
    }
    const updated = await this.replaceShifts(businessId, employee.id, shifts, userId);
    return updated.shifts;
  }

  /** Self-service: the caller's own payRate (read-only there) and payFrequency. Null when they have no linked employee record. */
  async findMyPayroll(businessId: string, userId: string): Promise<EmployeePayroll | null> {
    const employee = await this.employeesRepository.findByUserId(businessId, userId);
    if (!employee) return null;
    return {
      payRate: employee.pay_rate ? parseFloat(employee.pay_rate) : null,
      payFrequency: employee.pay_frequency,
    };
  }

  /**
   * Self-service: lets an employee choose their own pay cadence among
   * WEEK/BIWEEKLY/MONTH (enforced by UpdateMyPayFrequencyDto, not just this
   * check) — goes through the narrow updatePayFrequency() repository method
   * so pay_rate can never be touched from this path.
   */
  async updateMyPayFrequency(
    businessId: string,
    userId: string,
    payFrequency: EmployeePayFrequency,
  ): Promise<EmployeePayroll> {
    const employee = await this.employeesRepository.findByUserId(businessId, userId);
    if (!employee) {
      throw new EntityNotFoundException('Employee', userId);
    }
    const updated = await this.employeesRepository.updatePayFrequency(
      employee.id,
      businessId,
      payFrequency,
      undefined,
    );
    if (!updated) {
      throw new EntityNotFoundException('Employee', employee.id);
    }

    await this.auditService.record({
      businessId,
      userId,
      entityType: 'employee',
      entityId: employee.id,
      action: 'UPDATE_PAY_FREQUENCY',
      newValues: { payFrequency },
    });

    return {
      payRate: updated.pay_rate ? parseFloat(updated.pay_rate) : null,
      payFrequency: updated.pay_frequency,
    };
  }

  /**
   * Provisions a login account for a legacy employee (created before this
   * flow existed) that doesn't have one yet — same auto-generated handle +
   * fixed default password + forced change as EmployeesService.create().
   */
  async generateCredentials(
    businessId: string,
    id: string,
    input: GenerateEmployeeCredentialsInput,
    actorUserId?: string,
  ): Promise<EmployeeWithShifts> {
    const row = await this.getOwnedOrFail(businessId, id);
    if (row.user_id) {
      throw new BusinessRuleException(
        'This employee already has login credentials — use reset instead',
        'EMPLOYEE_CREDENTIALS_ALREADY_EXIST',
      );
    }

    const loginEmail = await this.usersService.generateUniqueLoginEmail(
      businessId,
      row.first_name,
      row.last_name,
    );
    const user = await this.usersService.create(
      businessId,
      {
        firstName: row.first_name,
        lastName: row.last_name,
        email: loginEmail,
        password: DEFAULT_EMPLOYEE_PASSWORD,
        roleId: input.roleId,
        branchId: input.branchId ?? row.branch_id ?? undefined,
        phone: row.phone ?? undefined,
        mustChangePassword: true,
      },
      actorUserId,
    );

    const updatedRow = await this.employeesRepository.setUserId(
      id,
      businessId,
      user.id,
    );
    if (!updatedRow) {
      throw new EntityNotFoundException('Employee', id);
    }

    await this.auditService.record({
      businessId,
      userId: actorUserId,
      entityType: 'employee',
      entityId: id,
      action: 'CREATE_CREDENTIALS',
      newValues: { email: loginEmail, roleId: input.roleId },
    });

    const shiftRows = await this.employeesRepository.findShifts(id);
    return {
      ...EmployeeMapper.toDomain(updatedRow),
      shifts: shiftRows.map((shift) => EmployeeMapper.shiftToDomain(shift)),
      userAccount: { id: user.id, email: user.email, status: user.status },
    };
  }

  /**
   * Issues a new random one-time password for an employee that already has
   * credentials (unlike initial provisioning, this is a genuine reset — the
   * old password may be lost/compromised) — still forces a change on next login.
   */
  async resetCredentials(
    businessId: string,
    id: string,
    actorUserId?: string,
  ): Promise<{ temporaryPassword: string }> {
    const row = await this.getOwnedOrFail(businessId, id);
    if (!row.user_id) {
      throw new BusinessRuleException(
        'This employee has no login credentials to reset',
        'EMPLOYEE_CREDENTIALS_NOT_FOUND',
      );
    }

    const temporaryPassword = generateTemporaryPassword();
    await this.usersService.setPasswordHash(row.user_id, temporaryPassword, true);

    await this.auditService.record({
      businessId,
      userId: actorUserId,
      entityType: 'employee',
      entityId: id,
      action: 'RESET_CREDENTIALS',
    });

    return { temporaryPassword };
  }

  /** Activates, deactivates or blocks an employee's login access without deleting the account. */
  async setCredentialsStatus(
    businessId: string,
    id: string,
    status: UserStatus,
    actorUserId?: string,
  ): Promise<EmployeeUserAccount> {
    const row = await this.getOwnedOrFail(businessId, id);
    if (!row.user_id) {
      throw new BusinessRuleException(
        'This employee has no login credentials',
        'EMPLOYEE_CREDENTIALS_NOT_FOUND',
      );
    }

    const user = await this.usersService.setStatus(
      businessId,
      row.user_id,
      status,
      actorUserId,
    );

    await this.auditService.record({
      businessId,
      userId: actorUserId,
      entityType: 'employee',
      entityId: id,
      action: 'CREDENTIALS_STATUS_CHANGE',
      newValues: { status },
    });

    return { id: user.id, email: user.email, status: user.status };
  }

  private async loadUserAccount(
    businessId: string,
    userId: string | null,
  ): Promise<EmployeeUserAccount | null> {
    if (!userId) return null;
    const user = await this.usersService.findRawById(userId, businessId);
    if (!user) return null;
    return { id: user.id, email: user.email, status: user.status };
  }

  /** The document number identifies one person: no two employees of a business may share it. */
  private async assertDocumentAvailable(
    businessId: string,
    documentNumber: string | undefined,
    exceptEmployeeId?: string,
  ): Promise<void> {
    if (!documentNumber) return;
    const existing = await this.employeesRepository.findByDocumentNumber(
      businessId,
      documentNumber,
    );
    if (existing && existing.id !== exceptEmployeeId) {
      throw new ConflictException(
        `Another employee already has document number ${documentNumber}`,
        'EMPLOYEE_DOCUMENT_TAKEN',
      );
    }
  }

  /** A shift may only point at a branch of this same business. */
  private async assertShiftBranchesOwned(
    businessId: string,
    shifts: ShiftInput[],
  ): Promise<void> {
    const branchIds = new Set(
      shifts.map((shift) => shift.branchId).filter((id): id is string => Boolean(id)),
    );
    for (const branchId of branchIds) {
      await this.branchesService.findOne(businessId, branchId);
    }
  }

  private async getOwnedOrFail(
    businessId: string,
    id: string,
  ): Promise<EmployeeRow> {
    const row = await this.employeesRepository.findById(id, businessId);
    if (!row) {
      throw new EntityNotFoundException('Employee', id);
    }
    return row;
  }
}
