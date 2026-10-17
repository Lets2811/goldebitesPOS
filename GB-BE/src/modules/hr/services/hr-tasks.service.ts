import { Inject, Injectable } from '@nestjs/common';
import { EntityNotFoundException } from '../../../common/exceptions';
import { AuditService } from '../../audit/services/audit.service';
import { BranchesService } from '../../branches/services/branches.service';
import { EMPLOYEES_REPOSITORY } from '../../employees/repositories/employees.repository.interface';
import type { IEmployeesRepository } from '../../employees/repositories/employees.repository.interface';
import { HrTask } from '../domain/hr-task.interface';
import {
  CreateHrTaskData,
  HrTaskQuery,
  HrTaskStatus,
  UpdateHrTaskData,
} from '../domain/hr-task.types';
import { HrTaskMapper } from '../mappers/hr-task.mapper';
import { HR_TASKS_REPOSITORY } from '../repositories/hr-tasks.repository.interface';
import type { IHrTasksRepository } from '../repositories/hr-tasks.repository.interface';

/** The team's task board: administrators manage it, each employee sees and moves their own tasks. */
@Injectable()
export class HrTasksService {
  constructor(
    @Inject(HR_TASKS_REPOSITORY)
    private readonly tasksRepository: IHrTasksRepository,
    @Inject(EMPLOYEES_REPOSITORY)
    private readonly employeesRepository: IEmployeesRepository,
    private readonly branchesService: BranchesService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(query: HrTaskQuery): Promise<HrTask[]> {
    const rows = await this.tasksRepository.findAll(query);
    return rows.map((row) => HrTaskMapper.toDomain(row));
  }

  async create(data: CreateHrTaskData): Promise<HrTask> {
    await this.assertReferencesOwned(data.businessId, data);
    const row = await this.tasksRepository.create(data);
    await this.auditService.record({
      businessId: data.businessId,
      userId: data.createdByUserId,
      entityType: 'hr_task',
      entityId: row.id,
      action: 'CREATE',
      newValues: { title: data.title, assigneeEmployeeId: data.assigneeEmployeeId ?? null },
    });
    return HrTaskMapper.toDomain(row);
  }

  async update(businessId: string, id: string, data: UpdateHrTaskData, actorUserId?: string): Promise<HrTask> {
    await this.getOwnedOrFail(businessId, id);
    await this.assertReferencesOwned(businessId, data);
    const row = await this.tasksRepository.update(id, businessId, data);
    if (!row) throw new EntityNotFoundException('HrTask', id);
    await this.auditService.record({
      businessId,
      userId: actorUserId,
      entityType: 'hr_task',
      entityId: id,
      action: 'UPDATE',
      newValues: data as Record<string, unknown>,
    });
    return HrTaskMapper.toDomain(row);
  }

  async remove(businessId: string, id: string, actorUserId?: string): Promise<void> {
    const deleted = await this.tasksRepository.softDelete(id, businessId);
    if (!deleted) throw new EntityNotFoundException('HrTask', id);
    await this.auditService.record({
      businessId,
      userId: actorUserId,
      entityType: 'hr_task',
      entityId: id,
      action: 'DELETE',
    });
  }

  /** Self-service: the tasks assigned to the caller. Empty when they aren't an employee. */
  async findMine(businessId: string, userId: string): Promise<HrTask[]> {
    const employee = await this.employeesRepository.findByUserId(businessId, userId);
    if (!employee) return [];
    return this.findAll({ businessId, assigneeEmployeeId: employee.id });
  }

  /** Self-service: an employee moves one of their own tasks (to done, typically). Nothing else of it. */
  async setMyTaskStatus(businessId: string, userId: string, id: string, status: HrTaskStatus): Promise<HrTask> {
    const employee = await this.employeesRepository.findByUserId(businessId, userId);
    const task = await this.getOwnedOrFail(businessId, id);
    if (!employee || task.assignee_employee_id !== employee.id) {
      // Same answer as a missing task: nobody learns about tasks that aren't theirs.
      throw new EntityNotFoundException('HrTask', id);
    }
    return this.update(businessId, id, { status }, userId);
  }

  private async getOwnedOrFail(businessId: string, id: string) {
    const row = await this.tasksRepository.findById(id, businessId);
    if (!row) throw new EntityNotFoundException('HrTask', id);
    return row;
  }

  /** The assignee and branch, when given, must belong to this business. */
  private async assertReferencesOwned(
    businessId: string,
    data: { assigneeEmployeeId?: string | null; branchId?: string | null },
  ): Promise<void> {
    if (data.assigneeEmployeeId) {
      const employee = await this.employeesRepository.findById(data.assigneeEmployeeId, businessId);
      if (!employee) throw new EntityNotFoundException('Employee', data.assigneeEmployeeId);
    }
    if (data.branchId) {
      await this.branchesService.findOne(businessId, data.branchId);
    }
  }
}
