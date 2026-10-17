import { LeaveRequest, LeaveRequestRow } from '../domain/leave-request.interface';

export class LeaveRequestMapper {
  static toDomain(row: LeaveRequestRow): LeaveRequest {
    return {
      id: row.id,
      employee: {
        id: row.employee_id,
        firstName: row.employee_first_name,
        lastName: row.employee_last_name,
      },
      type: row.type,
      startDate: row.start_date,
      endDate: row.end_date,
      reason: row.reason,
      status: row.status,
      reviewedAt: row.reviewed_at,
      reviewNote: row.review_note,
      createdAt: row.created_at,
    };
  }
}
