import { HrTaskPriority, HrTaskStatus } from './hr-task.types';

export interface HrTaskRow {
  id: string;
  business_id: string;
  branch_id: string | null;
  title: string;
  description: string | null;
  assignee_employee_id: string | null;
  assignee_first_name: string | null;
  assignee_last_name: string | null;
  status: HrTaskStatus;
  priority: HrTaskPriority;
  /** YYYY-MM-DD, read as text so no timezone can shift the day. */
  due_date: string | null;
  completed_at: Date | null;
  created_by_user_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface HrTaskAssignee {
  id: string;
  firstName: string;
  lastName: string;
}

export interface HrTask {
  id: string;
  branchId: string | null;
  title: string;
  description: string | null;
  assignee: HrTaskAssignee | null;
  status: HrTaskStatus;
  priority: HrTaskPriority;
  dueDate: string | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
