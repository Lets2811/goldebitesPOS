import { Inject, Injectable } from '@nestjs/common';
import {
  BusinessRuleException,
  ConflictException,
  EntityNotFoundException,
} from '../../../common/exceptions';
import { AuditService } from '../../audit/services/audit.service';
import { EMPLOYEES_REPOSITORY } from '../../employees/repositories/employees.repository.interface';
import type { IEmployeesRepository } from '../../employees/repositories/employees.repository.interface';
import { LeaveRequest } from '../domain/leave-request.interface';
import {
  LeaveRequestQuery,
  LeaveRequestStatus,
  LeaveRequestType,
} from '../domain/leave-request.types';
import { LeaveRequestMapper } from '../mappers/leave-request.mapper';
import { LEAVE_REQUESTS_REPOSITORY } from '../repositories/leave-requests.repository.interface';
import type { ILeaveRequestsRepository } from '../repositories/leave-requests.repository.interface';

export interface LeaveRequestInput {
  type: LeaveRequestType;
  startDate: string;
  endDate: string;
  reason?: string;
}

/** The answer an administrator gives to a pending request. */
export type LeaveDecision = LeaveRequestStatus.APPROVED | LeaveRequestStatus.REJECTED;

/**
 * Time-off requests ("permisos"): an employee asks from their profile and an
 * administrator approves or rejects. An administrator can also register one
 * for an employee directly (someone without access to the system, say),
 * which is approved from the start.
 */
@Injectable()
export class LeaveRequestsService {
  constructor(
    @Inject(LEAVE_REQUESTS_REPOSITORY)
    private readonly leaveRequestsRepository: ILeaveRequestsRepository,
    @Inject(EMPLOYEES_REPOSITORY)
    private readonly employeesRepository: IEmployeesRepository,
    private readonly auditService: AuditService,
  ) {}

  async findAll(query: LeaveRequestQuery): Promise<LeaveRequest[]> {
    const rows = await this.leaveRequestsRepository.findAll(query);
    return rows.map((row) => LeaveRequestMapper.toDomain(row));
  }

  async createForEmployee(
    businessId: string,
    employeeId: string,
    input: LeaveRequestInput,
    actorUserId: string,
  ): Promise<LeaveRequest> {
    const employee = await this.employeesRepository.findById(employeeId, businessId);
    if (!employee) throw new EntityNotFoundException('Employee', employeeId);
    return this.create(businessId, employeeId, input, actorUserId, LeaveRequestStatus.APPROVED);
  }

  async review(
    businessId: string,
    id: string,
    decision: LeaveDecision,
    note: string | undefined,
    actorUserId: string,
  ): Promise<LeaveRequest> {
    const row = await this.leaveRequestsRepository.resolve(id, businessId, decision, actorUserId, note ?? null);
    if (!row) throw await this.notPendingError(businessId, id);
    await this.auditService.record({
      businessId,
      userId: actorUserId,
      entityType: 'leave_request',
      entityId: id,
      action: decision === LeaveRequestStatus.APPROVED ? 'APPROVE' : 'REJECT',
      newValues: note ? { note } : undefined,
    });
    return LeaveRequestMapper.toDomain(row);
  }

  /** Self-service: the caller's own requests. Empty when they aren't an employee. */
  async findMine(businessId: string, userId: string): Promise<LeaveRequest[]> {
    const employee = await this.employeesRepository.findByUserId(businessId, userId);
    if (!employee) return [];
    return this.findAll({ businessId, employeeId: employee.id });
  }

  async requestMine(businessId: string, userId: string, input: LeaveRequestInput): Promise<LeaveRequest> {
    const employeeId = await this.myEmployeeIdOrFail(businessId, userId);
    return this.create(businessId, employeeId, input, userId, LeaveRequestStatus.PENDING);
  }

  /** Self-service: withdraws one of the caller's own requests while it's still pending. */
  async cancelMine(businessId: string, userId: string, id: string): Promise<LeaveRequest> {
    const employeeId = await this.myEmployeeIdOrFail(businessId, userId);
    const existing = await this.leaveRequestsRepository.findById(id, businessId);
    if (!existing || existing.employee_id !== employeeId) {
      throw new EntityNotFoundException('LeaveRequest', id);
    }
    const row = await this.leaveRequestsRepository.resolve(
      id,
      businessId,
      LeaveRequestStatus.CANCELLED,
      null,
      null,
    );
    if (!row) throw await this.notPendingError(businessId, id);
    return LeaveRequestMapper.toDomain(row);
  }

  private async create(
    businessId: string,
    employeeId: string,
    input: LeaveRequestInput,
    actorUserId: string,
    status: LeaveRequestStatus,
  ): Promise<LeaveRequest> {
    if (input.startDate > input.endDate) {
      throw new BusinessRuleException(
        'The start date must not be after the end date',
        'LEAVE_REQUEST_INVALID_RANGE',
      );
    }
    if (await this.leaveRequestsRepository.hasOverlap(employeeId, input.startDate, input.endDate)) {
      throw new ConflictException(
        'There is already a pending or approved request for some of these days',
        'LEAVE_REQUEST_OVERLAP',
      );
    }

    const row = await this.leaveRequestsRepository.create({
      businessId,
      employeeId,
      ...input,
      status,
      requestedByUserId: actorUserId,
      reviewedByUserId: status === LeaveRequestStatus.APPROVED ? actorUserId : undefined,
    });
    await this.auditService.record({
      businessId,
      userId: actorUserId,
      entityType: 'leave_request',
      entityId: row.id,
      action: 'CREATE',
      newValues: { employeeId, type: input.type, startDate: input.startDate, endDate: input.endDate, status },
    });
    return LeaveRequestMapper.toDomain(row);
  }

  private async myEmployeeIdOrFail(businessId: string, userId: string): Promise<string> {
    const employee = await this.employeesRepository.findByUserId(businessId, userId);
    if (!employee) {
      throw new BusinessRuleException(
        'Your account is not linked to an employee record',
        'NOT_AN_EMPLOYEE',
      );
    }
    return employee.id;
  }

  /** A request that couldn't be resolved: missing, or already answered. */
  private async notPendingError(businessId: string, id: string) {
    const existing = await this.leaveRequestsRepository.findById(id, businessId);
    if (!existing) return new EntityNotFoundException('LeaveRequest', id);
    return new BusinessRuleException('This request was already answered', 'LEAVE_REQUEST_NOT_PENDING');
  }
}
