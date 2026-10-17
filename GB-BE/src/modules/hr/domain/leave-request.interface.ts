import { LeaveRequestStatus, LeaveRequestType } from './leave-request.types';

export interface LeaveRequestRow {
  id: string;
  business_id: string;
  employee_id: string;
  employee_first_name: string;
  employee_last_name: string;
  type: LeaveRequestType;
  /** YYYY-MM-DD, read as text so no timezone can shift the day. */
  start_date: string;
  end_date: string;
  reason: string | null;
  status: LeaveRequestStatus;
  requested_by_user_id: string | null;
  reviewed_by_user_id: string | null;
  reviewed_at: Date | null;
  review_note: string | null;
  created_at: Date;
}

export interface LeaveRequest {
  id: string;
  employee: { id: string; firstName: string; lastName: string };
  type: LeaveRequestType;
  startDate: string;
  endDate: string;
  reason: string | null;
  status: LeaveRequestStatus;
  reviewedAt: Date | null;
  reviewNote: string | null;
  createdAt: Date;
}
