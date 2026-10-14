import { BusinessRuleException, CashSessionClosedException, EntityNotFoundException } from '../../../common/exceptions';
import { CashSessionStatus } from '../../cash-sessions/domain/cash-session.interface';
import { FundType } from '../../funds/domain/fund.types';
import { ExpenseRow } from '../domain/expense.interface';
import { ExpensePaymentSource } from '../domain/expense.types';
import { ExpensesService } from './expenses.service';

describe('ExpensesService', () => {
  let expensesRepository: {
    create: jest.Mock;
    findById: jest.Mock;
    findAll: jest.Mock;
    update: jest.Mock;
    updateSource: jest.Mock;
    softDelete: jest.Mock;
    getSummaryByCategory: jest.Mock;
    getDailyTotals: jest.Mock;
  };
  let categoriesService: { assertUsable: jest.Mock };
  let employeesService: { findOne: jest.Mock };
  let reimbursementsService: {
    createForExpense: jest.Mock;
    findActiveObligationForExpense: jest.Mock;
    voidObligationInTransaction: jest.Mock;
  };
  let cashSessionsService: { findAllOpen: jest.Mock; findOne: jest.Mock; recordMovementInTransaction: jest.Mock };
  let fundsService: { debit: jest.Mock; credit: jest.Mock };
  let transactionService: { execute: jest.Mock };
  let auditService: { record: jest.Mock };
  let service: ExpensesService;

  const businessId = 'business-1';
  const branchId = 'branch-1';
  const actorUserId = 'user-1';

  function makeExpenseRow(overrides: Partial<ExpenseRow> = {}): ExpenseRow {
    return {
      id: 'expense-1',
      business_id: businessId,
      branch_id: branchId,
      category: 'OPERATING',
      name: 'Aseo',
      description: 'Productos de limpieza',
      responsible: 'Ana',
      amount: '50000.00',
      expense_date: '2026-09-18',
      payment_source: ExpensePaymentSource.UNSPECIFIED_HISTORICAL,
      payer_employee_id: null,
      payer_name: null,
      cash_session_id: null,
      cash_movement_id: null,
      fund_movement_id: null,
      created_at: new Date(),
      updated_at: new Date(),
      deleted_at: null,
      ...overrides,
    };
  }

  beforeEach(() => {
    expensesRepository = {
      create: jest.fn().mockResolvedValue(makeExpenseRow()),
      findById: jest.fn(),
      findAll: jest.fn(),
      update: jest.fn(),
      updateSource: jest.fn().mockResolvedValue(makeExpenseRow()),
      softDelete: jest.fn(),
      getSummaryByCategory: jest.fn(),
      getDailyTotals: jest.fn().mockResolvedValue([]),
    };
    employeesService = { findOne: jest.fn() };
    reimbursementsService = {
      createForExpense: jest.fn(),
      findActiveObligationForExpense: jest.fn(),
      voidObligationInTransaction: jest.fn(),
    };
    cashSessionsService = {
      findAllOpen: jest.fn().mockResolvedValue([{ id: 'session-1', branchId, status: CashSessionStatus.OPEN }]),
      findOne: jest.fn(),
      recordMovementInTransaction: jest.fn().mockResolvedValue({ id: 'movement-1' }),
    };
    fundsService = {
      debit: jest.fn().mockResolvedValue({ id: 'fund-movement-1' }),
      credit: jest.fn().mockResolvedValue({ id: 'fund-movement-2' }),
    };
    transactionService = {
      execute: jest.fn((work: (client: unknown) => Promise<unknown>) => work({})),
    };
    auditService = { record: jest.fn() };
    categoriesService = { assertUsable: jest.fn().mockResolvedValue(undefined) };
    service = new ExpensesService(
      expensesRepository as never,
      employeesService as never,
      reimbursementsService as never,
      cashSessionsService as never,
      fundsService as never,
      transactionService as never,
      auditService as never,
      categoriesService as never,
    );
  });

  function baseCreateData(overrides: Record<string, unknown> = {}) {
    return {
      businessId,
      branchId,
      category: 'OPERATING',
      name: 'Aseo',
      description: 'Productos de limpieza',
      responsible: 'Ana',
      amount: 50000,
      expenseDate: '2026-09-18',
      paymentSource: ExpensePaymentSource.CASH_OPERATIONAL,
      ...overrides,
    };
  }

  describe('create — CASH_OPERATIONAL (BR-02/AC-02/AC-03/AC-04)', () => {
    it('auto-selects the single open session and posts an EXPENSE movement', async () => {
      await service.create(baseCreateData() as never, actorUserId);

      expect(cashSessionsService.findAllOpen).toHaveBeenCalledWith(businessId, branchId);
      expect(cashSessionsService.recordMovementInTransaction).toHaveBeenCalledWith(
        expect.objectContaining({ cashSessionId: 'session-1', amount: 50000 }),
        expect.anything(),
      );
      expect(expensesRepository.updateSource).toHaveBeenCalledWith(
        'expense-1',
        expect.objectContaining({ cashSessionId: 'session-1', cashMovementId: 'movement-1', fundMovementId: null }),
        expect.anything(),
      );
    });

    it('rejects with NO_OPEN_CASH_SESSION when there is no open session (AC-04)', async () => {
      cashSessionsService.findAllOpen.mockResolvedValue([]);

      await expect(service.create(baseCreateData() as never, actorUserId)).rejects.toThrow(BusinessRuleException);
      expect(cashSessionsService.recordMovementInTransaction).not.toHaveBeenCalled();
    });

    it('requires an explicit cashSessionId when multiple sessions are open (AC-03)', async () => {
      cashSessionsService.findAllOpen.mockResolvedValue([
        { id: 'session-1', branchId: 'branch-1', status: CashSessionStatus.OPEN },
        { id: 'session-2', branchId: 'branch-2', status: CashSessionStatus.OPEN },
      ]);

      await expect(
        service.create(baseCreateData({ branchId: undefined }) as never, actorUserId),
      ).rejects.toThrow(BusinessRuleException);
      expect(cashSessionsService.recordMovementInTransaction).not.toHaveBeenCalled();
    });

    it('uses the explicit cashSessionId when provided, validating it is open', async () => {
      cashSessionsService.findOne.mockResolvedValue({ id: 'session-2', branchId, status: CashSessionStatus.OPEN });

      await service.create(baseCreateData({ cashSessionId: 'session-2' }) as never, actorUserId);

      expect(cashSessionsService.findAllOpen).not.toHaveBeenCalled();
      expect(cashSessionsService.recordMovementInTransaction).toHaveBeenCalledWith(
        expect.objectContaining({ cashSessionId: 'session-2' }),
        expect.anything(),
      );
    });

    it('rejects an explicit cashSessionId that is not open', async () => {
      cashSessionsService.findOne.mockResolvedValue({ id: 'session-2', branchId, status: CashSessionStatus.CLOSED });

      await expect(
        service.create(baseCreateData({ cashSessionId: 'session-2' }) as never, actorUserId),
      ).rejects.toThrow(CashSessionClosedException);
      expect(cashSessionsService.recordMovementInTransaction).not.toHaveBeenCalled();
    });
  });

  describe('create — CASH_RESERVE / BANK_ACCOUNT (BR-03/BR-04/AC-05/AC-06)', () => {
    it('debits Reserva via FundsService, tagging the expense as the source', async () => {
      await service.create(baseCreateData({ paymentSource: ExpensePaymentSource.CASH_RESERVE }) as never, actorUserId);

      expect(fundsService.debit).toHaveBeenCalledWith(
        expect.objectContaining({
          businessId,
          branchId,
          fundType: FundType.CASH_RESERVE,
          amount: 50000,
          sourceType: 'EXPENSE',
          sourceId: 'expense-1',
          actorUserId,
        }),
      );
      expect(cashSessionsService.recordMovementInTransaction).not.toHaveBeenCalled();
      expect(expensesRepository.updateSource).toHaveBeenCalledWith(
        'expense-1',
        expect.objectContaining({ fundMovementId: 'fund-movement-1', cashSessionId: null, cashMovementId: null }),
        expect.anything(),
      );
    });

    it('debits Cuenta bancaria via FundsService, never touching the cash session', async () => {
      await service.create(baseCreateData({ paymentSource: ExpensePaymentSource.BANK_ACCOUNT }) as never, actorUserId);

      expect(fundsService.debit).toHaveBeenCalledWith(
        expect.objectContaining({ fundType: FundType.BANK_ACCOUNT }),
      );
      expect(cashSessionsService.findAllOpen).not.toHaveBeenCalled();
    });
  });

  describe('create — PERSONAL_MONEY', () => {
    it('rejects when neither payerEmployeeId nor payerName is provided', async () => {
      await expect(
        service.create(baseCreateData({ paymentSource: ExpensePaymentSource.PERSONAL_MONEY }) as never, actorUserId),
      ).rejects.toThrow(BusinessRuleException);
      expect(expensesRepository.create).not.toHaveBeenCalled();
    });

    it('creates the expense and an obligation atomically, using a free-text payer name', async () => {
      await service.create(
        baseCreateData({ paymentSource: ExpensePaymentSource.PERSONAL_MONEY, payerName: 'Carlos (socio)' }) as never,
        actorUserId,
      );

      expect(employeesService.findOne).not.toHaveBeenCalled();
      expect(reimbursementsService.createForExpense).toHaveBeenCalledWith(
        expect.objectContaining({ businessId, expenseId: 'expense-1', payerName: 'Carlos (socio)', originalAmount: 50000 }),
        expect.anything(),
      );
      expect(fundsService.debit).not.toHaveBeenCalled();
      expect(cashSessionsService.recordMovementInTransaction).not.toHaveBeenCalled();
    });

    it('derives the payer name from the linked employee server-side, ignoring any client-supplied payerName', async () => {
      employeesService.findOne.mockResolvedValue({ firstName: 'Ada', lastName: 'Lovelace' });

      await service.create(
        baseCreateData({
          paymentSource: ExpensePaymentSource.PERSONAL_MONEY,
          payerEmployeeId: 'emp-1',
          payerName: 'nombre que el cliente mandó y no debería usarse',
        }) as never,
        actorUserId,
      );

      expect(employeesService.findOne).toHaveBeenCalledWith(businessId, 'emp-1');
      expect(reimbursementsService.createForExpense).toHaveBeenCalledWith(
        expect.objectContaining({ payerEmployeeId: 'emp-1', payerName: 'Ada Lovelace' }),
        expect.anything(),
      );
    });

    it('propagates EntityNotFoundException when payerEmployeeId does not exist, creating nothing', async () => {
      employeesService.findOne.mockRejectedValue(new EntityNotFoundException('Employee', 'emp-bogus'));

      await expect(
        service.create(
          baseCreateData({ paymentSource: ExpensePaymentSource.PERSONAL_MONEY, payerEmployeeId: 'emp-bogus' }) as never,
          actorUserId,
        ),
      ).rejects.toThrow(EntityNotFoundException);
      expect(expensesRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('update — amount lock (decisión acordada)', () => {
    it('rejects an amount change once the expense has a real source', async () => {
      expensesRepository.findById.mockResolvedValue(makeExpenseRow({ payment_source: ExpensePaymentSource.CASH_RESERVE }));

      await expect(
        service.update(businessId, 'expense-1', { amount: 60000 }, actorUserId),
      ).rejects.toThrow(BusinessRuleException);
      expect(expensesRepository.update).not.toHaveBeenCalled();
    });

    it('allows an amount change while the source is still UNSPECIFIED_HISTORICAL', async () => {
      expensesRepository.findById.mockResolvedValue(makeExpenseRow({ payment_source: ExpensePaymentSource.UNSPECIFIED_HISTORICAL }));
      expensesRepository.update.mockResolvedValue(makeExpenseRow({ amount: '60000.00' }));

      await service.update(businessId, 'expense-1', { amount: 60000 }, actorUserId);

      expect(expensesRepository.update).toHaveBeenCalled();
    });

    it('allows non-amount edits regardless of source, without consulting findById', async () => {
      expensesRepository.update.mockResolvedValue(makeExpenseRow({ responsible: 'Beto' }));

      await service.update(businessId, 'expense-1', { responsible: 'Beto' }, actorUserId);

      expect(expensesRepository.findById).not.toHaveBeenCalled();
      expect(expensesRepository.update).toHaveBeenCalled();
    });
  });

  describe('reclassifySource (BR-08)', () => {
    it('rejects reclassifying to the same source it already has', async () => {
      expensesRepository.findById.mockResolvedValue(makeExpenseRow({ payment_source: ExpensePaymentSource.CASH_RESERVE }));

      await expect(
        service.reclassifySource(businessId, 'expense-1', {
          paymentSource: ExpensePaymentSource.CASH_RESERVE,
          reason: 'motivo de prueba',
          actorUserId,
        }),
      ).rejects.toThrow(BusinessRuleException);
      expect(expensesRepository.updateSource).not.toHaveBeenCalled();
    });

    it('AC-11: reclassifies a historical expense without reversing anything', async () => {
      expensesRepository.findById.mockResolvedValue(makeExpenseRow({ payment_source: ExpensePaymentSource.UNSPECIFIED_HISTORICAL }));

      await service.reclassifySource(businessId, 'expense-1', {
        paymentSource: ExpensePaymentSource.CASH_RESERVE,
        reason: 'se identificó la fuente real',
        actorUserId,
      });

      expect(fundsService.credit).not.toHaveBeenCalled();
      expect(cashSessionsService.recordMovementInTransaction).not.toHaveBeenCalled();
      expect(fundsService.debit).toHaveBeenCalledWith(
        expect.objectContaining({ fundType: FundType.CASH_RESERVE, sourceType: 'EXPENSE_RECLASSIFICATION' }),
      );
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'RECLASSIFY_SOURCE',
          oldValues: { paymentSource: ExpensePaymentSource.UNSPECIFIED_HISTORICAL },
          newValues: { paymentSource: ExpensePaymentSource.CASH_RESERVE },
        }),
      );
    });

    it('AC-12: reclassifying away from Caja operativa inserts an EXPENSE_REVERSAL movement before applying the new source', async () => {
      expensesRepository.findById.mockResolvedValue(
        makeExpenseRow({ payment_source: ExpensePaymentSource.CASH_OPERATIONAL, cash_session_id: 'session-1' }),
      );

      await service.reclassifySource(businessId, 'expense-1', {
        paymentSource: ExpensePaymentSource.BANK_ACCOUNT,
        reason: 'sesión abierta, se corrige a banco',
        actorUserId,
      });

      expect(cashSessionsService.recordMovementInTransaction).toHaveBeenCalledWith(
        expect.objectContaining({ cashSessionId: 'session-1', movementType: 'EXPENSE_REVERSAL' }),
        expect.anything(),
      );
      expect(fundsService.debit).toHaveBeenCalledWith(expect.objectContaining({ fundType: FundType.BANK_ACCOUNT }));
    });

    it('reverses a fund-sourced expense via credit(), keyed by a fresh reclassification id (not the original expense id)', async () => {
      expensesRepository.findById.mockResolvedValue(makeExpenseRow({ payment_source: ExpensePaymentSource.CASH_RESERVE }));

      await service.reclassifySource(businessId, 'expense-1', {
        paymentSource: ExpensePaymentSource.BANK_ACCOUNT,
        reason: 'fondo equivocado',
        actorUserId,
      });

      expect(fundsService.credit).toHaveBeenCalledWith(
        expect.objectContaining({ fundType: FundType.CASH_RESERVE, sourceType: 'EXPENSE_RECLASSIFICATION_REVERSAL' }),
      );
      const creditSourceId = fundsService.credit.mock.calls[0][0].sourceId;
      const debitSourceId = fundsService.debit.mock.calls[0][0].sourceId;
      expect(creditSourceId).toBe(debitSourceId); // same reclassification event
      expect(creditSourceId).not.toBe('expense-1'); // distinct from the original creation's sourceId
    });

    it('AC-14: reclassifying to PERSONAL_MONEY creates a new obligation', async () => {
      expensesRepository.findById.mockResolvedValue(makeExpenseRow({ payment_source: ExpensePaymentSource.CASH_RESERVE }));

      await service.reclassifySource(businessId, 'expense-1', {
        paymentSource: ExpensePaymentSource.PERSONAL_MONEY,
        payerName: 'Carlos (socio)',
        reason: 'en realidad lo pagó Carlos',
        actorUserId,
      });

      expect(reimbursementsService.createForExpense).toHaveBeenCalledWith(
        expect.objectContaining({ expenseId: 'expense-1', payerName: 'Carlos (socio)', originalAmount: 50000 }),
        expect.anything(),
      );
    });

    it('reclassifying away from PERSONAL_MONEY with no reimbursements voids the obligation', async () => {
      expensesRepository.findById.mockResolvedValue(makeExpenseRow({ payment_source: ExpensePaymentSource.PERSONAL_MONEY }));
      reimbursementsService.findActiveObligationForExpense.mockResolvedValue({
        id: 'obligation-1',
        reimbursedAmount: 0,
      });

      await service.reclassifySource(businessId, 'expense-1', {
        paymentSource: ExpensePaymentSource.CASH_RESERVE,
        reason: 'en realidad fue de la reserva',
        actorUserId,
      });

      expect(reimbursementsService.voidObligationInTransaction).toHaveBeenCalledWith(
        businessId,
        'obligation-1',
        actorUserId,
        'en realidad fue de la reserva',
        expect.anything(),
      );
      expect(fundsService.debit).toHaveBeenCalled();
    });

    it('AC-14: rejects reclassifying away from PERSONAL_MONEY when reimbursements already exist', async () => {
      expensesRepository.findById.mockResolvedValue(makeExpenseRow({ payment_source: ExpensePaymentSource.PERSONAL_MONEY }));
      reimbursementsService.findActiveObligationForExpense.mockResolvedValue({
        id: 'obligation-1',
        reimbursedAmount: 20000,
      });

      await expect(
        service.reclassifySource(businessId, 'expense-1', {
          paymentSource: ExpensePaymentSource.CASH_RESERVE,
          reason: 'intento de corrección',
          actorUserId,
        }),
      ).rejects.toThrow(BusinessRuleException);
      expect(reimbursementsService.voidObligationInTransaction).not.toHaveBeenCalled();
      expect(fundsService.debit).not.toHaveBeenCalled();
      expect(expensesRepository.updateSource).not.toHaveBeenCalled();
    });
  });
  describe('expense category', () => {
    it('records an expense only under a category the business uses', async () => {
      await service.create(baseCreateData() as never, actorUserId);

      expect(categoriesService.assertUsable).toHaveBeenCalledWith(businessId, 'OPERATING');
    });

    it('records nothing, and moves no money, when the category is not usable', async () => {
      categoriesService.assertUsable.mockRejectedValue(
        new BusinessRuleException('unknown', 'UNKNOWN_EXPENSE_CATEGORY'),
      );

      await expect(service.create(baseCreateData() as never, actorUserId)).rejects.toThrow(BusinessRuleException);
      expect(expensesRepository.create).not.toHaveBeenCalled();
      expect(cashSessionsService.recordMovementInTransaction).not.toHaveBeenCalled();
    });

    it('checks the category again when an expense is moved to another', async () => {
      expensesRepository.update.mockResolvedValue(makeExpenseRow());
      await service.update(businessId, 'expense-1', { category: 'PAYROLL' }, actorUserId);
      expect(categoriesService.assertUsable).toHaveBeenCalledWith(businessId, 'PAYROLL');

      categoriesService.assertUsable.mockClear();
      await service.update(businessId, 'expense-1', { name: 'Otro nombre' }, actorUserId);
      expect(categoriesService.assertUsable).not.toHaveBeenCalled();
    });

    it('getDailyTotals() returns the total of each day as numbers', async () => {
      expensesRepository.getDailyTotals.mockResolvedValue([
        { date: '2026-10-01', total: '120000.00' },
        { date: '2026-10-03', total: '45000.50' },
      ]);

      const totals = await service.getDailyTotals({ businessId, dateFrom: '2026-10-01', dateTo: '2026-10-31' });

      expect(totals).toEqual([
        { date: '2026-10-01', total: 120000 },
        { date: '2026-10-03', total: 45000.5 },
      ]);
    });
  });
});
