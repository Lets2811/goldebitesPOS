export interface BranchRule {
  id: string;
  businessId: string;
  branchId: string;
  title: string;
  description: string | null;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface BranchRuleInput {
  title: string;
  description?: string;
}

export interface HrProfile {
  role: {
    name: string;
    description: string | null;
  };
  branchRules: BranchRule[];
}

export type HrTaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';
export type HrTaskPriority = 'LOW' | 'MEDIUM' | 'HIGH';

export interface HrTask {
  id: string;
  branchId: string | null;
  title: string;
  description: string | null;
  assignee: { id: string; firstName: string; lastName: string } | null;
  status: HrTaskStatus;
  priority: HrTaskPriority;
  /** YYYY-MM-DD */
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Null clears a field when updating. */
export interface HrTaskInput {
  title: string;
  description?: string | null;
  assigneeEmployeeId?: string | null;
  branchId?: string | null;
  priority?: HrTaskPriority;
  status?: HrTaskStatus;
  dueDate?: string | null;
}

export type LeaveRequestType = 'PERMISSION' | 'VACATION' | 'SICK' | 'DAY_OFF' | 'OTHER';
export type LeaveRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface LeaveRequest {
  id: string;
  employee: { id: string; firstName: string; lastName: string };
  type: LeaveRequestType;
  /** YYYY-MM-DD, both days included. */
  startDate: string;
  endDate: string;
  reason: string | null;
  status: LeaveRequestStatus;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
}

export interface LeaveRequestInput {
  type: LeaveRequestType;
  startDate: string;
  endDate: string;
  reason?: string;
}

export type RosterAbsence =
  | { kind: 'LEAVE'; type: LeaveRequestType }
  | { kind: 'STATUS'; status: 'ON_VACATION' | 'ON_LEAVE' };

export interface RosterEntry {
  employeeId: string;
  firstName: string;
  lastName: string;
  roleId: string | null;
  branchId: string | null;
  /** HH:mm */
  startTime: string;
  endTime: string;
  absence: RosterAbsence | null;
}

export interface RosterDay {
  /** YYYY-MM-DD */
  date: string;
  entries: RosterEntry[];
}
