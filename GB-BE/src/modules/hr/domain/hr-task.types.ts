export enum HrTaskStatus {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  DONE = 'DONE',
}

export enum HrTaskPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

export interface CreateHrTaskData {
  businessId: string;
  branchId?: string;
  title: string;
  description?: string;
  assigneeEmployeeId?: string;
  priority?: HrTaskPriority;
  status?: HrTaskStatus;
  dueDate?: string;
  createdByUserId?: string;
}

/** Null clears the field; undefined leaves it as it is. */
export interface UpdateHrTaskData {
  branchId?: string | null;
  title?: string;
  description?: string | null;
  assigneeEmployeeId?: string | null;
  priority?: HrTaskPriority;
  status?: HrTaskStatus;
  dueDate?: string | null;
}

export interface HrTaskQuery {
  businessId: string;
  status?: HrTaskStatus;
  assigneeEmployeeId?: string;
  branchId?: string;
}
