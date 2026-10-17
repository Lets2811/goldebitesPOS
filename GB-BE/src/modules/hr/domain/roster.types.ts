import { EmployeeStatus } from '../../employees/domain/employee.types';
import { LeaveRequestType } from './leave-request.types';

/** One weekly shift of an employee, with what the roster needs to know about them. */
export interface RosterShiftRow {
  employee_id: string;
  first_name: string;
  last_name: string;
  role_id: string | null;
  employee_branch_id: string | null;
  status: EmployeeStatus;
  /** YYYY-MM-DD, read as text. */
  hire_date: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  shift_branch_id: string | null;
}

/** Days an employee is away, from an approved leave request. */
export interface RosterLeave {
  employeeId: string;
  type: LeaveRequestType;
  startDate: string;
  endDate: string;
}

/** Why someone scheduled for a day won't be there. */
export type RosterAbsence =
  | { kind: 'LEAVE'; type: LeaveRequestType }
  | { kind: 'STATUS'; status: EmployeeStatus };

export interface RosterEntry {
  employeeId: string;
  firstName: string;
  lastName: string;
  roleId: string | null;
  /** Where the shift is worked: the shift's branch, else the employee's. */
  branchId: string | null;
  startTime: string;
  endTime: string;
  absence: RosterAbsence | null;
}

export interface RosterDay {
  date: string;
  entries: RosterEntry[];
}
