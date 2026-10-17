import { DbClient } from '../../../database/types/database.types';
import { LeaveRequestRow } from '../domain/leave-request.interface';
import {
  CreateLeaveRequestData,
  LeaveRequestQuery,
  LeaveRequestStatus,
} from '../domain/leave-request.types';
import { RosterLeave } from '../domain/roster.types';

export interface ILeaveRequestsRepository {
  create(data: CreateLeaveRequestData, client?: DbClient): Promise<LeaveRequestRow>;
  findById(id: string, businessId: string): Promise<LeaveRequestRow | null>;
  findAll(query: LeaveRequestQuery): Promise<LeaveRequestRow[]>;
  /** Whether the employee already has a pending or approved request touching these dates. */
  hasOverlap(employeeId: string, startDate: string, endDate: string): Promise<boolean>;
  /** Moves a request out of PENDING; null when it no longer was pending. */
  resolve(
    id: string,
    businessId: string,
    status: LeaveRequestStatus,
    reviewedByUserId: string | null,
    reviewNote: string | null,
  ): Promise<LeaveRequestRow | null>;
  findApprovedBetween(businessId: string, from: string, to: string): Promise<RosterLeave[]>;
}

export const LEAVE_REQUESTS_REPOSITORY = Symbol('LEAVE_REQUESTS_REPOSITORY');
