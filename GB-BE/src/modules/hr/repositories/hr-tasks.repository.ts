import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service';
import { DbClient } from '../../../database/types/database.types';
import { HrTaskRow } from '../domain/hr-task.interface';
import { CreateHrTaskData, HrTaskQuery, HrTaskStatus, UpdateHrTaskData } from '../domain/hr-task.types';
import { IHrTasksRepository } from './hr-tasks.repository.interface';

/** The task plus its assignee's name, so a list needs no second lookup. */
const SELECT_TASK = `
  SELECT t.id, t.business_id, t.branch_id, t.title, t.description, t.assignee_employee_id,
         e.first_name AS assignee_first_name, e.last_name AS assignee_last_name,
         t.status, t.priority, t.due_date::text AS due_date, t.completed_at,
         t.created_by_user_id, t.created_at, t.updated_at
  FROM hr_tasks t
  LEFT JOIN employees e ON e.id = t.assignee_employee_id`;

/** Columns update() may set, by the field that carries each one. */
const UPDATABLE_COLUMNS: Record<keyof UpdateHrTaskData, string> = {
  branchId: 'branch_id',
  title: 'title',
  description: 'description',
  assigneeEmployeeId: 'assignee_employee_id',
  priority: 'priority',
  status: 'status',
  dueDate: 'due_date',
};

@Injectable()
export class HrTasksRepository implements IHrTasksRepository {
  constructor(private readonly db: DatabaseService) {}

  async create(data: CreateHrTaskData, client?: DbClient): Promise<HrTaskRow> {
    const status = data.status ?? HrTaskStatus.TODO;
    const inserted = await this.db.query<{ id: string }>(
      `INSERT INTO hr_tasks (business_id, branch_id, title, description, assignee_employee_id,
                             priority, status, due_date, completed_at, created_by_user_id)
       VALUES ($1, $2, $3, $4, $5, COALESCE($6, 'MEDIUM'), $7::varchar, $8,
               CASE WHEN $7::varchar = 'DONE' THEN now() END, $9)
       RETURNING id`,
      [
        data.businessId,
        data.branchId ?? null,
        data.title,
        data.description ?? null,
        data.assigneeEmployeeId ?? null,
        data.priority ?? null,
        status,
        data.dueDate ?? null,
        data.createdByUserId ?? null,
      ],
      client,
    );
    const row = await this.findById(inserted.rows[0].id, data.businessId, client);
    return row!;
  }

  async findById(id: string, businessId: string, client?: DbClient): Promise<HrTaskRow | null> {
    const result = await this.db.query<HrTaskRow>(
      `${SELECT_TASK}
       WHERE t.id = $1 AND t.business_id = $2 AND t.deleted_at IS NULL`,
      [id, businessId],
      client,
    );
    return result.rows[0] ?? null;
  }

  async findAll(query: HrTaskQuery): Promise<HrTaskRow[]> {
    const conditions = ['t.business_id = $1', 't.deleted_at IS NULL'];
    const params: unknown[] = [query.businessId];
    if (query.status) {
      params.push(query.status);
      conditions.push(`t.status = $${params.length}`);
    }
    if (query.assigneeEmployeeId) {
      params.push(query.assigneeEmployeeId);
      conditions.push(`t.assignee_employee_id = $${params.length}`);
    }
    if (query.branchId) {
      params.push(query.branchId);
      conditions.push(`(t.branch_id = $${params.length} OR t.branch_id IS NULL)`);
    }
    const result = await this.db.query<HrTaskRow>(
      `${SELECT_TASK}
       WHERE ${conditions.join(' AND ')}
       ORDER BY t.due_date NULLS LAST, t.created_at DESC
       LIMIT 500`,
      params,
    );
    return result.rows;
  }

  async update(id: string, businessId: string, data: UpdateHrTaskData): Promise<HrTaskRow | null> {
    const assignments: string[] = [];
    const params: unknown[] = [id, businessId];
    for (const [field, column] of Object.entries(UPDATABLE_COLUMNS)) {
      const value = data[field as keyof UpdateHrTaskData];
      if (value === undefined) continue;
      params.push(value);
      if (field === 'status') {
        // Done keeps the moment it was first finished; reopening clears it. The cast
        // lets Postgres type the one parameter used both as a value and in the comparison.
        assignments.push(`status = $${params.length}::varchar`);
        assignments.push(
          `completed_at = CASE WHEN $${params.length}::varchar = 'DONE' THEN COALESCE(completed_at, now()) END`,
        );
      } else {
        assignments.push(`${column} = $${params.length}`);
      }
    }
    if (assignments.length > 0) {
      await this.db.query(
        `UPDATE hr_tasks SET ${assignments.join(', ')}
         WHERE id = $1 AND business_id = $2 AND deleted_at IS NULL`,
        params,
      );
    }
    return this.findById(id, businessId);
  }

  async softDelete(id: string, businessId: string): Promise<boolean> {
    const result = await this.db.query(
      `UPDATE hr_tasks SET deleted_at = now()
       WHERE id = $1 AND business_id = $2 AND deleted_at IS NULL`,
      [id, businessId],
    );
    return result.rowCount > 0;
  }
}
