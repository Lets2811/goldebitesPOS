export type EmployeeStatus = 'ACTIVE' | 'INACTIVE' | 'ON_VACATION' | 'ON_LEAVE';

export type EmployeePayFrequency = 'SHIFT' | 'WEEK' | 'BIWEEKLY' | 'MONTH';

export type EmployeeDocumentType = 'CC' | 'CE' | 'TI' | 'PPT' | 'PASSPORT' | 'NIT' | 'OTHER';

/** The subset an employee may self-select for their own payroll cadence — SHIFT stays an admin-only classification. */
export const SELF_SERVICE_PAY_FREQUENCIES: EmployeePayFrequency[] = ['WEEK', 'BIWEEKLY', 'MONTH'];

export interface EmployeePayroll {
  payRate: number | null;
  payFrequency: EmployeePayFrequency | null;
}

export type CredentialsStatus = 'ACTIVE' | 'INACTIVE' | 'BLOCKED';

export interface EmployeeUserAccount {
  id: string;
  email: string;
  status: CredentialsStatus;
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

export interface Employee {
  id: string;
  businessId: string;
  branchId: string | null;
  roleId: string | null;
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
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeWithShifts extends Employee {
  shifts: EmployeeShift[];
  userAccount: EmployeeUserAccount | null;
}

export interface CreateEmployeePayload {
  firstName: string;
  lastName: string;
  documentType?: EmployeeDocumentType;
  documentNumber?: string;
  status?: EmployeeStatus;
  /** False registers the employee without a login account; it can be generated later. */
  createAccess?: boolean;
  phone?: string;
  email?: string;
  position?: string;
  /** Also becomes the auto-created login account's role. */
  roleId: string;
  branchId?: string;
  hireDate?: string;
  notes?: string;
  payRate?: number;
  payFrequency?: EmployeePayFrequency;
}

export type UpdateEmployeePayload = Partial<Omit<CreateEmployeePayload, 'createAccess'>>;

export interface ShiftInput {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  /** Omitted or null: the employee's own branch. */
  branchId?: string | null;
}

export interface GenerateEmployeeCredentialsPayload {
  roleId: string;
  branchId?: string;
}

export interface EmployeeFilters {
  page?: number;
  limit?: number;
  status?: EmployeeStatus;
  branchId?: string;
  search?: string;
}
