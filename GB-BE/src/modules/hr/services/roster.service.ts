import { Inject, Injectable } from '@nestjs/common';
import { BusinessRuleException } from '../../../common/exceptions';
import { EmployeeStatus } from '../../employees/domain/employee.types';
import { RosterAbsence, RosterDay, RosterLeave, RosterShiftRow } from '../domain/roster.types';
import { LEAVE_REQUESTS_REPOSITORY } from '../repositories/leave-requests.repository.interface';
import type { ILeaveRequestsRepository } from '../repositories/leave-requests.repository.interface';
import { ROSTER_REPOSITORY } from '../repositories/roster.repository.interface';
import type { IRosterRepository } from '../repositories/roster.repository.interface';

/** A month view with its leading and trailing week fits; anything longer is a report, not a roster. */
export const MAX_ROSTER_DAYS = 62;

const DAY_MS = 24 * 60 * 60 * 1000;

/** The calendar days from `from` to `to`, both included, as YYYY-MM-DD. */
function eachDay(from: string, to: string): string[] {
  const days: string[] = [];
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= Date.parse(`${to}T00:00:00Z`); t += DAY_MS) {
    days.push(new Date(t).toISOString().slice(0, 10));
  }
  return days;
}

/**
 * Who should be working each day: every weekly shift that falls on that
 * weekday, from the employee's hire date on. Someone on an approved leave, or
 * whose status says they're away, still shows up — marked absent — so the
 * administrator sees the gap in the schedule instead of losing it.
 */
export function buildRoster(
  shifts: RosterShiftRow[],
  leaves: RosterLeave[],
  from: string,
  to: string,
  branchId?: string,
): RosterDay[] {
  return eachDay(from, to).map((date) => {
    const dayOfWeek = new Date(`${date}T00:00:00Z`).getUTCDay();
    const entries = shifts
      .filter((shift) => shift.day_of_week === dayOfWeek)
      .filter((shift) => !shift.hire_date || shift.hire_date <= date)
      .map((shift) => ({ shift, branch: shift.shift_branch_id ?? shift.employee_branch_id }))
      // No branch on either side means the employee works wherever they're needed.
      .filter(({ branch }) => !branchId || !branch || branch === branchId)
      .map(({ shift, branch }) => ({
        employeeId: shift.employee_id,
        firstName: shift.first_name,
        lastName: shift.last_name,
        roleId: shift.role_id,
        branchId: branch,
        startTime: shift.start_time,
        endTime: shift.end_time,
        absence: absenceOn(shift, leaves, date),
      }));
    return { date, entries };
  });
}

function absenceOn(shift: RosterShiftRow, leaves: RosterLeave[], date: string): RosterAbsence | null {
  const leave = leaves.find(
    (l) => l.employeeId === shift.employee_id && l.startDate <= date && l.endDate >= date,
  );
  if (leave) return { kind: 'LEAVE', type: leave.type };
  if (shift.status === EmployeeStatus.ON_VACATION || shift.status === EmployeeStatus.ON_LEAVE) {
    return { kind: 'STATUS', status: shift.status };
  }
  return null;
}

@Injectable()
export class RosterService {
  constructor(
    @Inject(ROSTER_REPOSITORY)
    private readonly rosterRepository: IRosterRepository,
    @Inject(LEAVE_REQUESTS_REPOSITORY)
    private readonly leaveRequestsRepository: ILeaveRequestsRepository,
  ) {}

  async getRoster(businessId: string, from: string, to: string, branchId?: string): Promise<RosterDay[]> {
    if (from > to) {
      throw new BusinessRuleException('The start date must not be after the end date', 'ROSTER_INVALID_RANGE');
    }
    const days = (Date.parse(to) - Date.parse(from)) / DAY_MS + 1;
    if (days > MAX_ROSTER_DAYS) {
      throw new BusinessRuleException(
        `A roster covers at most ${MAX_ROSTER_DAYS} days`,
        'ROSTER_RANGE_TOO_LONG',
      );
    }

    const [shifts, leaves] = await Promise.all([
      this.rosterRepository.findShifts(businessId),
      this.leaveRequestsRepository.findApprovedBetween(businessId, from, to),
    ]);
    return buildRoster(shifts, leaves, from, to, branchId);
  }
}
