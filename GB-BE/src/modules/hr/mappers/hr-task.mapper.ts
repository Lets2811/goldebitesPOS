import { HrTask, HrTaskRow } from '../domain/hr-task.interface';

export class HrTaskMapper {
  static toDomain(row: HrTaskRow): HrTask {
    return {
      id: row.id,
      branchId: row.branch_id,
      title: row.title,
      description: row.description,
      assignee: row.assignee_employee_id
        ? {
            id: row.assignee_employee_id,
            firstName: row.assignee_first_name ?? '',
            lastName: row.assignee_last_name ?? '',
          }
        : null,
      status: row.status,
      priority: row.priority,
      dueDate: row.due_date,
      completedAt: row.completed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
