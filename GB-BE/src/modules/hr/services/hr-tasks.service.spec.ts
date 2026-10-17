import { EntityNotFoundException } from '../../../common/exceptions';
import { HrTaskRow } from '../domain/hr-task.interface';
import { HrTaskPriority, HrTaskStatus } from '../domain/hr-task.types';
import { HrTasksService } from './hr-tasks.service';

describe('HrTasksService', () => {
  const businessId = 'business-1';
  let tasksRepository: {
    create: jest.Mock;
    findById: jest.Mock;
    findAll: jest.Mock;
    update: jest.Mock;
    softDelete: jest.Mock;
  };
  let employeesRepository: { findById: jest.Mock; findByUserId: jest.Mock };
  let branchesService: { findOne: jest.Mock };
  let service: HrTasksService;

  function makeTask(overrides: Partial<HrTaskRow> = {}): HrTaskRow {
    return {
      id: 'task-1',
      business_id: businessId,
      branch_id: null,
      title: 'Limpiar la campana',
      description: null,
      assignee_employee_id: 'employee-1',
      assignee_first_name: 'Ana',
      assignee_last_name: 'Gómez',
      status: HrTaskStatus.TODO,
      priority: HrTaskPriority.MEDIUM,
      due_date: '2026-10-20',
      completed_at: null,
      created_by_user_id: 'admin-1',
      created_at: new Date(),
      updated_at: new Date(),
      ...overrides,
    };
  }

  beforeEach(() => {
    tasksRepository = {
      create: jest.fn().mockResolvedValue(makeTask()),
      findById: jest.fn().mockResolvedValue(makeTask()),
      findAll: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue(makeTask({ status: HrTaskStatus.DONE })),
      softDelete: jest.fn().mockResolvedValue(true),
    };
    employeesRepository = {
      findById: jest.fn().mockResolvedValue({ id: 'employee-1' }),
      findByUserId: jest.fn().mockResolvedValue({ id: 'employee-1' }),
    };
    branchesService = { findOne: jest.fn() };
    service = new HrTasksService(
      tasksRepository as never,
      employeesRepository as never,
      branchesService as never,
      { record: jest.fn() } as never,
    );
  });

  it('creates a task with its assignee', async () => {
    const task = await service.create({
      businessId,
      title: 'Limpiar la campana',
      assigneeEmployeeId: 'employee-1',
      dueDate: '2026-10-20',
    });

    expect(task.assignee).toEqual({ id: 'employee-1', firstName: 'Ana', lastName: 'Gómez' });
    expect(task.dueDate).toBe('2026-10-20');
  });

  it('rejects an assignee from another business', async () => {
    employeesRepository.findById.mockResolvedValue(null);

    await expect(
      service.create({ businessId, title: 'X', assigneeEmployeeId: 'employee-9' }),
    ).rejects.toThrow(EntityNotFoundException);
    expect(tasksRepository.create).not.toHaveBeenCalled();
  });

  it("lets an employee mark their own task done", async () => {
    const task = await service.setMyTaskStatus(businessId, 'user-1', 'task-1', HrTaskStatus.DONE);

    expect(tasksRepository.update).toHaveBeenCalledWith('task-1', businessId, { status: HrTaskStatus.DONE });
    expect(task.status).toBe(HrTaskStatus.DONE);
  });

  it("does not let an employee touch someone else's task", async () => {
    tasksRepository.findById.mockResolvedValue(makeTask({ assignee_employee_id: 'employee-2' }));

    await expect(
      service.setMyTaskStatus(businessId, 'user-1', 'task-1', HrTaskStatus.DONE),
    ).rejects.toThrow(EntityNotFoundException);
    expect(tasksRepository.update).not.toHaveBeenCalled();
  });

  it('gives no tasks to a user without an employee record', async () => {
    employeesRepository.findByUserId.mockResolvedValue(null);

    await expect(service.findMine(businessId, 'owner-1')).resolves.toEqual([]);
    expect(tasksRepository.findAll).not.toHaveBeenCalled();
  });
});
