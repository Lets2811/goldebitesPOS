export enum LeaveRequestType {
  PERMISSION = 'PERMISSION',
  VACATION = 'VACATION',
  SICK = 'SICK',
  DAY_OFF = 'DAY_OFF',
  OTHER = 'OTHER',
}

export enum LeaveRequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

export interface CreateLeaveRequestData {
  businessId: string;
  employeeId: string;
  type: LeaveRequestType;
  startDate: string;
  endDate: string;
  reason?: string;
  status: LeaveRequestStatus;
  requestedByUserId?: string;
  /** Set when an administrator registers it already approved. */
  reviewedByUserId?: string;
}

export interface LeaveRequestQuery {
  businessId: string;
  status?: LeaveRequestStatus;
  employeeId?: string;
}
