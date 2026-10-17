import {
  EmployeeDocumentType,
  EmployeePayFrequency,
  EmployeeStatus,
} from './employee.types';
import { UserStatus } from '../../users/domain/user.types';

export interface Employee {
  id: string;
  businessId: string;
  branchId: string | null;
  roleId: string | null;
  userId: string | null;
  firstName: string;
  lastName: string;
  documentType: EmployeeDocumentType | null;
  documentNumber: string | null;
  phone: string | null;
  email: string | null;
  position: string | null;
  status: EmployeeStatus;
  hireDate: string | null;
  notes: string | null;
  payRate: number | null;
  payFrequency: EmployeePayFrequency | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmployeeRow {
  id: string;
  business_id: string;
  branch_id: string | null;
  role_id: string | null;
  user_id: string | null;
  first_name: string;
  last_name: string;
  document_type: EmployeeDocumentType | null;
  document_number: string | null;
  phone: string | null;
  email: string | null;
  position: string | null;
  status: EmployeeStatus;
  hire_date: string | null;
  notes: string | null;
  pay_rate: string | null;
  pay_frequency: EmployeePayFrequency | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

/** Trimmed, non-sensitive view of the linked login account — never includes password_hash. */
export interface EmployeeUserAccount {
  id: string;
  email: string;
  status: UserStatus;
}

export interface EmployeeShift {
  id: string;
  employeeId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  /** Null: the employee's own branch. */
  branchId: string | null;
}

export interface EmployeeShiftRow {
  id: string;
  employee_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  branch_id: string | null;
}

export interface EmployeeWithShifts extends Employee {
  shifts: EmployeeShift[];
  userAccount: EmployeeUserAccount | null;
}

/** Self-service view — payRate is read-only there, so it's the only field ever exposed on that path. */
export interface EmployeePayroll {
  payRate: number | null;
  payFrequency: EmployeePayFrequency | null;
}
