import {
  BusinessRuleException,
  ConflictException,
  EntityNotFoundException,
} from '../../../common/exceptions';
import { LeaveRequestRow } from '../domain/leave-request.interface';
import { LeaveRequestStatus, LeaveRequestType } from '../domain/leave-request.types';
import { LeaveRequestsService } from './leave-requests.service';

describe('LeaveRequestsService', () => {
  const businessId = 'business-1';
  const input = {
    type: LeaveRequestType.PERMISSION,
    startDate: '2026-10-20',
    endDate: '2026-10-21',
    reason: 'Cita médica',
  };
  let repository: {
    create: jest.Mock;
    findById: jest.Mock;
    findAll: jest.Mock;
    hasOverlap: jest.Mock;
    resolve: jest.Mock;
    findApprovedBetween: jest.Mock;
  };
  let employeesRepository: { findById: jest.Mock; findByUserId: jest.Mock };
  let service: LeaveRequestsService;

  function makeRequest(overrides: Partial<LeaveRequestRow> = {}): LeaveRequestRow {
    return {
      id: 'request-1',
      business_id: businessId,
      employee_id: 'employee-1',
      employee_first_name: 'Ana',
      employee_last_name: 'Gómez',
      type: LeaveRequestType.PERMISSION,
      start_date: '2026-10-20',
      end_date: '2026-10-21',
      reason: 'Cita médica',
      status: LeaveRequestStatus.PENDING,
      requested_by_user_id: 'user-1',
      reviewed_by_user_id: null,
      reviewed_at: null,
      review_note: null,
      created_at: new Date(),
      ...overrides,
    };
  }

  beforeEach(() => {
    repository = {
      create: jest.fn().mockResolvedValue(makeRequest()),
      findById: jest.fn().mockResolvedValue(makeRequest()),
      findAll: jest.fn().mockResolvedValue([]),
      hasOverlap: jest.fn().mockResolvedValue(false),
      resolve: jest.fn().mockResolvedValue(makeRequest({ status: LeaveRequestStatus.APPROVED })),
      findApprovedBetween: jest.fn(),
    };
    employeesRepository = {
      findById: jest.fn().mockResolvedValue({ id: 'employee-1' }),
      findByUserId: jest.fn().mockResolvedValue({ id: 'employee-1' }),
    };
    service = new LeaveRequestsService(
      repository as never,
      employeesRepository as never,
      { record: jest.fn() } as never,
    );
  });

  it("files an employee's own request as pending", async () => {
    await service.requestMine(businessId, 'user-1', input);

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        employeeId: 'employee-1',
        status: LeaveRequestStatus.PENDING,
        requestedByUserId: 'user-1',
        reviewedByUserId: undefined,
      }),
    );
  });

  it('rejects a request for days that already have one', async () => {
    repository.hasOverlap.mockResolvedValue(true);

    await expect(service.requestMine(businessId, 'user-1', input)).rejects.toThrow(ConflictException);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('rejects a range that ends before it starts', async () => {
    await expect(
      service.requestMine(businessId, 'user-1', { ...input, startDate: '2026-10-22' }),
    ).rejects.toThrow(BusinessRuleException);
  });

  it('tells a user without an employee record that they cannot ask', async () => {
    employeesRepository.findByUserId.mockResolvedValue(null);

    await expect(service.requestMine(businessId, 'owner-1', input)).rejects.toThrow(BusinessRuleException);
  });

  it('registers time off for an employee as already approved by the administrator', async () => {
    await service.createForEmployee(businessId, 'employee-1', input, 'admin-1');

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: LeaveRequestStatus.APPROVED, reviewedByUserId: 'admin-1' }),
    );
  });

  it('approves a pending request', async () => {
    const request = await service.review(businessId, 'request-1', LeaveRequestStatus.APPROVED, 'Listo', 'admin-1');

    expect(repository.resolve).toHaveBeenCalledWith(
      'request-1',
      businessId,
      LeaveRequestStatus.APPROVED,
      'admin-1',
      'Listo',
    );
    expect(request.status).toBe(LeaveRequestStatus.APPROVED);
  });

  it('says so when the request was already answered', async () => {
    repository.resolve.mockResolvedValue(null);
    repository.findById.mockResolvedValue(makeRequest({ status: LeaveRequestStatus.REJECTED }));

    await expect(
      service.review(businessId, 'request-1', LeaveRequestStatus.APPROVED, undefined, 'admin-1'),
    ).rejects.toThrow(BusinessRuleException);
  });

  it("does not let an employee cancel someone else's request", async () => {
    repository.findById.mockResolvedValue(makeRequest({ employee_id: 'employee-2' }));

    await expect(service.cancelMine(businessId, 'user-1', 'request-1')).rejects.toThrow(
      EntityNotFoundException,
    );
    expect(repository.resolve).not.toHaveBeenCalled();
  });
});
