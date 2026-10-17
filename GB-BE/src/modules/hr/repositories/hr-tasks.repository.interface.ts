import { DbClient } from '../../../database/types/database.types';
import { HrTaskRow } from '../domain/hr-task.interface';
import { CreateHrTaskData, HrTaskQuery, UpdateHrTaskData } from '../domain/hr-task.types';

export interface IHrTasksRepository {
  create(data: CreateHrTaskData, client?: DbClient): Promise<HrTaskRow>;
  findById(id: string, businessId: string): Promise<HrTaskRow | null>;
  findAll(query: HrTaskQuery): Promise<HrTaskRow[]>;
  update(id: string, businessId: string, data: UpdateHrTaskData): Promise<HrTaskRow | null>;
  softDelete(id: string, businessId: string): Promise<boolean>;
}

export const HR_TASKS_REPOSITORY = Symbol('HR_TASKS_REPOSITORY');
