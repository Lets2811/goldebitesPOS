export enum EmployeeStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  ON_VACATION = 'ON_VACATION',
  ON_LEAVE = 'ON_LEAVE',
}

export enum EmployeePayFrequency {
  SHIFT = 'SHIFT',
  WEEK = 'WEEK',
  BIWEEKLY = 'BIWEEKLY',
  MONTH = 'MONTH',
}

/** Colombian identity document kinds, plus a catch-all. */
export enum EmployeeDocumentType {
  CC = 'CC',
  CE = 'CE',
  TI = 'TI',
  PPT = 'PPT',
  PASSPORT = 'PASSPORT',
  NIT = 'NIT',
  OTHER = 'OTHER',
}

/** The subset an employee may self-select for their own payroll cadence — SHIFT stays an admin-only classification. */
export const SELF_SERVICE_PAY_FREQUENCIES = [
  EmployeePayFrequency.WEEK,
  EmployeePayFrequency.BIWEEKLY,
  EmployeePayFrequency.MONTH,
] as const;

export interface ShiftInput {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  /** Where this shift is worked; omitted means the employee's own branch. */
  branchId?: string | null;
}

export interface CreateEmployeeData {
  businessId: string;
  branchId?: string;
  /** Required — the employee's job, and their login account's role when one is created. */
  roleId: string;
  firstName: string;
  lastName: string;
  documentType?: EmployeeDocumentType;
  documentNumber?: string;
  status?: EmployeeStatus;
  /** False registers the employee without a login account (it can be generated later). Defaults to true. */
  createAccess?: boolean;
  phone?: string;
  email?: string;
  position?: string;
  hireDate?: string;
  notes?: string;
  payRate?: number;
  payFrequency?: EmployeePayFrequency;
}

export interface UpdateEmployeeData {
  branchId?: string;
  roleId?: string;
  firstName?: string;
  lastName?: string;
  documentType?: EmployeeDocumentType;
  documentNumber?: string;
  status?: EmployeeStatus;
  phone?: string;
  email?: string;
  position?: string;
  hireDate?: string;
  notes?: string;
  payRate?: number;
  payFrequency?: EmployeePayFrequency;
}

export interface EmployeeQuery {
  businessId: string;
  page: number;
  limit: number;
  status?: EmployeeStatus;
  branchId?: string;
  search?: string;
}
