import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service';
import { DbClient } from '../../../database/types/database.types';
import { LeaveRequestRow } from '../domain/leave-request.interface';
import {
  CreateLeaveRequestData,
  LeaveRequestQuery,
  LeaveRequestStatus,
  LeaveRequestType,
} from '../domain/leave-request.types';
import { RosterLeave } from '../domain/roster.types';
import { ILeaveRequestsRepository } from './leave-requests.repository.interface';

/** The request plus the employee's name, so a list needs no second lookup. */
const SELECT_REQUEST = `
  SELECT r.id, r.business_id, r.employee_id, e.first_name AS employee_first_name,
         e.last_name AS employee_last_name, r.type, r.start_date::text AS start_date,
         r.end_date::text AS end_date, r.reason, r.status, r.requested_by_user_id,
         r.reviewed_by_user_id, r.reviewed_at, r.review_note, r.created_at
  FROM leave_requests r
  JOIN employees e ON e.id = r.employee_id`;

@Injectable()
export class LeaveRequestsRepository implements ILeaveRequestsRepository {
  constructor(private readonly db: DatabaseService) {}

  async create(data: CreateLeaveRequestData, client?: DbClient): Promise<LeaveRequestRow> {
    const inserted = await this.db.query<{ id: string }>(
      `INSERT INTO leave_requests (business_id, employee_id, type, start_date, end_date, reason,
                                   status, requested_by_user_id, reviewed_by_user_id, reviewed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::uuid, CASE WHEN $9::uuid IS NOT NULL THEN now() END)
       RETURNING id`,
      [
        data.businessId,
        data.employeeId,
        data.type,
        data.startDate,
        data.endDate,
        data.reason ?? null,
        data.status,
        data.requestedByUserId ?? null,
        data.reviewedByUserId ?? null,
      ],
      client,
    );
    const result = await this.db.query<LeaveRequestRow>(
      `${SELECT_REQUEST} WHERE r.id = $1`,
      [inserted.rows[0].id],
      client,
    );
    return result.rows[0];
  }

  async findById(id: string, businessId: string): Promise<LeaveRequestRow | null> {
    const result = await this.db.query<LeaveRequestRow>(
      `${SELECT_REQUEST} WHERE r.id = $1 AND r.business_id = $2`,
      [id, businessId],
    );
    return result.rows[0] ?? null;
  }

  async findAll(query: LeaveRequestQuery): Promise<LeaveRequestRow[]> {
    const conditions = ['r.business_id = $1'];
    const params: unknown[] = [query.businessId];
    if (query.status) {
      params.push(query.status);
      conditions.push(`r.status = $${params.length}`);
    }
    if (query.employeeId) {
      params.push(query.employeeId);
      conditions.push(`r.employee_id = $${params.length}`);
    }
    // Pending first (what needs an answer), then the most recent.
    const result = await this.db.query<LeaveRequestRow>(
      `${SELECT_REQUEST}
       WHERE ${conditions.join(' AND ')}
       ORDER BY (r.status = 'PENDING') DESC, r.start_date DESC, r.created_at DESC
       LIMIT 300`,
      params,
    );
    return result.rows;
  }

  async hasOverlap(employeeId: string, startDate: string, endDate: string): Promise<boolean> {
    const result = await this.db.query(
      `SELECT 1 FROM leave_requests
       WHERE employee_id = $1 AND status IN ('PENDING', 'APPROVED')
         AND start_date <= $3 AND end_date >= $2
       LIMIT 1`,
      [employeeId, startDate, endDate],
    );
    return result.rowCount > 0;
  }

  async resolve(
    id: string,
    businessId: string,
    status: LeaveRequestStatus,
    reviewedByUserId: string | null,
    reviewNote: string | null,
  ): Promise<LeaveRequestRow | null> {
    const updated = await this.db.query(
      `UPDATE leave_requests
       SET status = $3, reviewed_by_user_id = $4::uuid, review_note = $5,
           reviewed_at = CASE WHEN $4::uuid IS NOT NULL THEN now() END
       WHERE id = $1 AND business_id = $2 AND status = 'PENDING'`,
      [id, businessId, status, reviewedByUserId, reviewNote],
    );
    if (updated.rowCount === 0) return null;
    return this.findById(id, businessId);
  }

  async findApprovedBetween(businessId: string, from: string, to: string): Promise<RosterLeave[]> {
    const result = await this.db.query<{
      employee_id: string;
      type: LeaveRequestType;
      start_date: string;
      end_date: string;
    }>(
      `SELECT employee_id, type, start_date::text AS start_date, end_date::text AS end_date
       FROM leave_requests
       WHERE business_id = $1 AND status = 'APPROVED' AND start_date <= $3 AND end_date >= $2`,
      [businessId, from, to],
    );
    return result.rows.map((row) => ({
      employeeId: row.employee_id,
      type: row.type,
      startDate: row.start_date,
      endDate: row.end_date,
    }));
  }
}
