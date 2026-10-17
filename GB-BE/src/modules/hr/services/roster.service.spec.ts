import { BusinessRuleException } from '../../../common/exceptions';
import { EmployeeStatus } from '../../employees/domain/employee.types';
import { LeaveRequestType } from '../domain/leave-request.types';
import { RosterShiftRow } from '../domain/roster.types';
import { RosterService, buildRoster } from './roster.service';

function shift(overrides: Partial<RosterShiftRow> = {}): RosterShiftRow {
  return {
    employee_id: 'ana',
    first_name: 'Ana',
    last_name: 'Gómez',
    role_id: 'role-1',
    employee_branch_id: 'centro',
    status: EmployeeStatus.ACTIVE,
    hire_date: null,
    // 2026-10-14 is a Wednesday.
    day_of_week: 3,
    start_time: '15:00',
    end_time: '22:00',
    shift_branch_id: null,
    ...overrides,
  };
}

describe('buildRoster', () => {
  it('puts each weekly shift on the days of its weekday', () => {
    const days = buildRoster([shift()], [], '2026-10-12', '2026-10-18');

    expect(days.map((day) => day.date)).toEqual([
      '2026-10-12',
      '2026-10-13',
      '2026-10-14',
      '2026-10-15',
      '2026-10-16',
      '2026-10-17',
      '2026-10-18',
    ]);
    expect(days.filter((day) => day.entries.length > 0).map((day) => day.date)).toEqual(['2026-10-14']);
    expect(days[2].entries[0]).toEqual(
      expect.objectContaining({ employeeId: 'ana', startTime: '15:00', endTime: '22:00', absence: null }),
    );
  });

  it("uses the shift's branch, else the employee's, and filters by it", () => {
    const shifts = [
      shift({ employee_id: 'ana', shift_branch_id: 'norte' }),
      shift({ employee_id: 'luis', first_name: 'Luis' }),
      shift({ employee_id: 'sin-sede', first_name: 'Eva', employee_branch_id: null }),
    ];

    const [day] = buildRoster(shifts, [], '2026-10-14', '2026-10-14', 'norte');

    expect(day.entries.map((entry) => [entry.employeeId, entry.branchId])).toEqual([
      ['ana', 'norte'],
      ['sin-sede', null],
    ]);
  });

  it('marks someone on approved leave as absent instead of dropping them', () => {
    const [day] = buildRoster(
      [shift()],
      [{ employeeId: 'ana', type: LeaveRequestType.SICK, startDate: '2026-10-13', endDate: '2026-10-14' }],
      '2026-10-14',
      '2026-10-14',
    );

    expect(day.entries[0].absence).toEqual({ kind: 'LEAVE', type: LeaveRequestType.SICK });
  });

  it('marks someone on vacation by status as absent', () => {
    const [day] = buildRoster([shift({ status: EmployeeStatus.ON_VACATION })], [], '2026-10-14', '2026-10-14');

    expect(day.entries[0].absence).toEqual({ kind: 'STATUS', status: EmployeeStatus.ON_VACATION });
  });

  it('leaves out the days before the hire date', () => {
    const days = buildRoster([shift({ hire_date: '2026-10-15' })], [], '2026-10-14', '2026-10-21');

    expect(days.filter((day) => day.entries.length > 0).map((day) => day.date)).toEqual(['2026-10-21']);
  });
});

describe('RosterService', () => {
  const rosterRepository = { findShifts: jest.fn().mockResolvedValue([]) };
  const leaveRequestsRepository = { findApprovedBetween: jest.fn().mockResolvedValue([]) };
  const service = new RosterService(rosterRepository as never, leaveRequestsRepository as never);

  it('rejects a range longer than two months', async () => {
    await expect(service.getRoster('business-1', '2026-01-01', '2026-03-31')).rejects.toThrow(
      BusinessRuleException,
    );
  });

  it('rejects a range that ends before it starts', async () => {
    await expect(service.getRoster('business-1', '2026-10-20', '2026-10-14')).rejects.toThrow(
      BusinessRuleException,
    );
  });

  it('builds a month from the shifts and approved leave of the business', async () => {
    const days = await service.getRoster('business-1', '2026-10-01', '2026-10-31');

    expect(days).toHaveLength(31);
    expect(leaveRequestsRepository.findApprovedBetween).toHaveBeenCalledWith(
      'business-1',
      '2026-10-01',
      '2026-10-31',
    );
  });
});
