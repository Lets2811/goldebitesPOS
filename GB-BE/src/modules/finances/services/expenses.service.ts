import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { BusinessRuleException, CashSessionClosedException, EntityNotFoundException } from '../../../common/exceptions';
import { PaginatedResult } from '../../../common/pagination/paginated-result.interface';
import { buildPaginationMeta } from '../../../common/pagination/pagination.util';
import { DbClient } from '../../../database/types/database.types';
import { TransactionService } from '../../../database/transaction.service';
import { AuditService } from '../../audit/services/audit.service';
import { CashSession, CashSessionStatus, CashMovementType } from '../../cash-sessions/domain/cash-session.interface';
import { CashSessionsService } from '../../cash-sessions/services/cash-sessions.service';
import { EmployeesService } from '../../employees/services/employees.service';
import { FundType } from '../../funds/domain/fund.types';
import { FundsService } from '../../funds/services/funds.service';
import { Expense } from '../domain/expense.interface';
import {
  CreateExpenseData,
  ExpenseCategoryTotal,
  ExpenseDailyTotal,
  ExpensePaymentSource,
  ExpenseQuery,
  ExpenseSummaryQuery,
  ReclassifyExpenseSourceData,
  UpdateExpenseData,
} from '../domain/expense.types';
import { ExpenseCategoriesService } from './expense-categories.service';
import { ExpenseMapper } from '../mappers/expense.mapper';
import { EXPENSES_REPOSITORY } from '../repositories/expenses.repository.interface';
import type { IExpensesRepository } from '../repositories/expenses.repository.interface';
import { ReimbursementsService } from './reimbursements.service';

interface SourceEffectPointers {
  cashSessionId: string | null;
  cashMovementId: string | null;
  fundMovementId: string | null;
}

interface ApplySourceEffectParams {
  paymentSource: ExpensePaymentSource;
  businessId: string;
  branchId?: string;
  amount: number;
  description: string;
  actorUserId: string;
  fundSourceType: string;
  fundSourceId: string;
  cashSessionId?: string;
  expenseId: string;
  payerEmployeeId?: string;
  payerName?: string;
}

const NO_EFFECT_POINTERS: SourceEffectPointers = { cashSessionId: null, cashMovementId: null, fundMovementId: null };

@Injectable()
export class ExpensesService {
  constructor(
    @Inject(EXPENSES_REPOSITORY)
    private readonly expensesRepository: IExpensesRepository,
    private readonly employeesService: EmployeesService,
    private readonly reimbursementsService: ReimbursementsService,
    private readonly cashSessionsService: CashSessionsService,
    private readonly fundsService: FundsService,
    private readonly transactionService: TransactionService,
    private readonly auditService: AuditService,
    private readonly categoriesService: ExpenseCategoriesService,
  ) {}

  async create(data: CreateExpenseData, actorUserId: string): Promise<Expense> {
    await this.categoriesService.assertUsable(data.businessId, data.category);
    const payerName = await this.resolvePayerName(
      data.businessId,
      data.paymentSource,
      data.payerEmployeeId,
      data.payerName,
    );

    const row = await this.transactionService.execute(async (client) => {
      const created = await this.expensesRepository.create({ ...data, payerName }, client);

      const pointers = await this.applySourceEffect(
        {
          paymentSource: data.paymentSource,
          businessId: data.businessId,
          branchId: data.branchId,
          amount: data.amount,
          description: data.description,
          actorUserId,
          fundSourceType: 'EXPENSE',
          fundSourceId: created.id,
          cashSessionId: data.cashSessionId,
          expenseId: created.id,
          payerEmployeeId: data.payerEmployeeId,
          payerName,
        },
        client,
      );

      return this.expensesRepository.updateSource(
        created.id,
        { paymentSource: data.paymentSource, payerEmployeeId: data.payerEmployeeId, payerName, ...pointers },
        client,
      );
    });

    await this.auditService.record({
      businessId: data.businessId,
      branchId: data.branchId,
      userId: actorUserId,
      entityType: 'expense',
      entityId: row.id,
      action: 'CREATE',
      newValues: { category: row.category, amount: row.amount, paymentSource: row.payment_source },
    });
    return ExpenseMapper.toDomain(row);
  }

  async findAll(query: ExpenseQuery): Promise<PaginatedResult<Expense>> {
    const { rows, total } = await this.expensesRepository.findAll(query);
    return {
      data: rows.map((row) => ExpenseMapper.toDomain(row)),
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  async update(
    businessId: string,
    id: string,
    data: UpdateExpenseData,
    actorUserId?: string,
  ): Promise<Expense> {
    if (data.amount !== undefined) {
      const existing = await this.expensesRepository.findById(id, businessId);
      if (!existing) {
        throw new EntityNotFoundException('Expense', id);
      }
      if (existing.payment_source !== ExpensePaymentSource.UNSPECIFIED_HISTORICAL) {
        throw new BusinessRuleException(
          'Amount cannot be edited once a real source has been applied — void and recreate the expense instead',
          'AMOUNT_LOCKED_BY_SOURCE',
        );
      }
    }

    if (data.category !== undefined) {
      await this.categoriesService.assertUsable(businessId, data.category);
    }

    const row = await this.expensesRepository.update(id, businessId, data);
    if (!row) {
      throw new EntityNotFoundException('Expense', id);
    }
    await this.auditService.record({
      businessId,
      userId: actorUserId,
      entityType: 'expense',
      entityId: id,
      action: 'UPDATE',
      newValues: data as Record<string, unknown>,
    });
    return ExpenseMapper.toDomain(row);
  }

  /**
   * BR-08: the only way an expense's source ever changes — never a direct
   * edit. Reverses whatever effect the current source had, then applies the
   * new one, atomically. `reclassificationId` keys the fund-ledger entries
   * this reclassification produces (see FundsService's sourceType/sourceId
   * idempotency/conflict guarantees from GOL-12) — distinct from the
   * `expenseId`-keyed entries the original creation used.
   */
  async reclassifySource(
    businessId: string,
    id: string,
    data: ReclassifyExpenseSourceData,
  ): Promise<Expense> {
    const row = await this.expensesRepository.findById(id, businessId);
    if (!row) {
      throw new EntityNotFoundException('Expense', id);
    }
    const expense = ExpenseMapper.toDomain(row);

    if (expense.paymentSource === data.paymentSource) {
      throw new BusinessRuleException(
        'Nothing to reclassify — the expense already has this source',
        'SAME_SOURCE',
      );
    }

    const payerName = await this.resolvePayerName(
      businessId,
      data.paymentSource,
      data.payerEmployeeId,
      data.payerName,
    );
    const reclassificationId = randomUUID();
    const branchId = data.branchId ?? expense.branchId ?? undefined;

    const updatedRow = await this.transactionService.execute(async (client) => {
      await this.reverseSourceEffect(
        expense,
        { reason: data.reason, actorUserId: data.actorUserId, reclassificationId },
        client,
      );

      const pointers = await this.applySourceEffect(
        {
          paymentSource: data.paymentSource,
          businessId,
          branchId,
          amount: expense.amount,
          description: expense.description,
          actorUserId: data.actorUserId,
          fundSourceType: 'EXPENSE_RECLASSIFICATION',
          fundSourceId: reclassificationId,
          cashSessionId: data.cashSessionId,
          expenseId: expense.id,
          payerEmployeeId: data.payerEmployeeId,
          payerName,
        },
        client,
      );

      return this.expensesRepository.updateSource(
        id,
        { paymentSource: data.paymentSource, payerEmployeeId: data.payerEmployeeId, payerName, ...pointers },
        client,
      );
    });

    await this.auditService.record({
      businessId,
      branchId: expense.branchId ?? undefined,
      userId: data.actorUserId,
      entityType: 'expense',
      entityId: id,
      action: 'RECLASSIFY_SOURCE',
      oldValues: { paymentSource: expense.paymentSource },
      newValues: { paymentSource: data.paymentSource },
      metadata: { reason: data.reason, reclassificationId },
    });

    return ExpenseMapper.toDomain(updatedRow);
  }

  async softDelete(
    businessId: string,
    id: string,
    actorUserId?: string,
  ): Promise<void> {
    const row = await this.expensesRepository.softDelete(id, businessId);
    if (!row) {
      throw new EntityNotFoundException('Expense', id);
    }
    await this.auditService.record({
      businessId,
      userId: actorUserId,
      entityType: 'expense',
      entityId: id,
      action: 'DELETE',
    });
  }

  async getDailyTotals(query: ExpenseSummaryQuery): Promise<ExpenseDailyTotal[]> {
    const rows = await this.expensesRepository.getDailyTotals(query);
    return rows.map((row) => ({ date: row.date, total: parseFloat(row.total) }));
  }

  async getSummaryByCategory(
    query: ExpenseSummaryQuery,
  ): Promise<ExpenseCategoryTotal[]> {
    const rows = await this.expensesRepository.getSummaryByCategory(query);
    return rows.map((row) => ExpenseMapper.categoryTotalToDomain(row));
  }

  private async applySourceEffect(
    params: ApplySourceEffectParams,
    client: DbClient,
  ): Promise<SourceEffectPointers> {
    switch (params.paymentSource) {
      case ExpensePaymentSource.CASH_OPERATIONAL: {
        const session = await this.resolveCashSessionForExpense(
          params.businessId,
          params.branchId,
          params.cashSessionId,
        );
        const movement = await this.cashSessionsService.recordMovementInTransaction(
          {
            cashSessionId: session.id,
            movementType: CashMovementType.EXPENSE,
            amount: params.amount,
            description: params.description,
            createdBy: params.actorUserId,
          },
          client,
        );
        return { cashSessionId: session.id, cashMovementId: movement.id, fundMovementId: null };
      }

      case ExpensePaymentSource.CASH_RESERVE:
      case ExpensePaymentSource.BANK_ACCOUNT: {
        const movement = await this.fundsService.debit({
          businessId: params.businessId,
          branchId: params.branchId,
          fundType: params.paymentSource === ExpensePaymentSource.CASH_RESERVE ? FundType.CASH_RESERVE : FundType.BANK_ACCOUNT,
          amount: params.amount,
          sourceType: params.fundSourceType,
          sourceId: params.fundSourceId,
          actorUserId: params.actorUserId,
          notes: params.description,
        });
        return { cashSessionId: null, cashMovementId: null, fundMovementId: movement.id };
      }

      case ExpensePaymentSource.PERSONAL_MONEY:
        await this.reimbursementsService.createForExpense(
          {
            businessId: params.businessId,
            expenseId: params.expenseId,
            payerEmployeeId: params.payerEmployeeId,
            payerName: params.payerName as string,
            originalAmount: params.amount,
          },
          client,
        );
        return NO_EFFECT_POINTERS;

      case ExpensePaymentSource.UNSPECIFIED_HISTORICAL:
      default:
        return NO_EFFECT_POINTERS;
    }
  }

  private async reverseSourceEffect(
    expense: Expense,
    params: { reason: string; actorUserId: string; reclassificationId: string },
    client: DbClient,
  ): Promise<void> {
    switch (expense.paymentSource) {
      case ExpensePaymentSource.CASH_OPERATIONAL: {
        if (!expense.cashSessionId) {
          throw new BusinessRuleException(
            'This expense has no linked cash session to reverse',
            'MISSING_CASH_SESSION_POINTER',
          );
        }
        // Insert-only ledger (AC-12/AC-13): never edits/deletes the original
        // EXPENSE movement, even if its session has since closed — a closed
        // session's frozen expected/actual snapshot is never recomputed, but
        // a correcting entry still belongs in the ledger for the audit trail.
        await this.cashSessionsService.recordMovementInTransaction(
          {
            cashSessionId: expense.cashSessionId,
            movementType: CashMovementType.EXPENSE_REVERSAL,
            amount: expense.amount,
            description: `Reversión por reclasificación: ${params.reason}`,
            createdBy: params.actorUserId,
          },
          client,
        );
        return;
      }

      case ExpensePaymentSource.CASH_RESERVE:
      case ExpensePaymentSource.BANK_ACCOUNT:
        await this.fundsService.credit({
          businessId: expense.businessId,
          branchId: expense.branchId ?? undefined,
          fundType: expense.paymentSource === ExpensePaymentSource.CASH_RESERVE ? FundType.CASH_RESERVE : FundType.BANK_ACCOUNT,
          amount: expense.amount,
          sourceType: 'EXPENSE_RECLASSIFICATION_REVERSAL',
          sourceId: params.reclassificationId,
          actorUserId: params.actorUserId,
          notes: params.reason,
        });
        return;

      case ExpensePaymentSource.PERSONAL_MONEY: {
        const obligation = await this.reimbursementsService.findActiveObligationForExpense(
          expense.businessId,
          expense.id,
          client,
        );
        if (!obligation) {
          throw new BusinessRuleException(
            'No active reimbursement obligation found for this expense',
            'OBLIGATION_NOT_FOUND',
          );
        }
        if (obligation.reimbursedAmount > 0) {
          // AC-14 / BR-08: reversing individual reimbursement payments is
          // GOL-9 scope — this reclassification is rejected (whole
          // transaction rolls back) until that happens externally.
          throw new BusinessRuleException(
            'Existing reimbursements must be reversed before changing this source',
            'REIMBURSEMENTS_MUST_BE_REVERSED_FIRST',
          );
        }
        await this.reimbursementsService.voidObligationInTransaction(
          expense.businessId,
          obligation.id,
          params.actorUserId,
          params.reason,
          client,
        );
        return;
      }

      case ExpensePaymentSource.UNSPECIFIED_HISTORICAL:
      default:
        // BR-07: a historical expense never had a real effect to reverse.
        return;
    }
  }

  private async resolveCashSessionForExpense(
    businessId: string,
    branchId: string | undefined,
    explicitCashSessionId: string | undefined,
  ): Promise<CashSession> {
    if (explicitCashSessionId) {
      const session = await this.cashSessionsService.findOne(businessId, explicitCashSessionId);
      if (session.status !== CashSessionStatus.OPEN) {
        throw new CashSessionClosedException(explicitCashSessionId);
      }
      return session;
    }

    const openSessions = await this.cashSessionsService.findAllOpen(businessId, branchId);
    if (openSessions.length === 0) {
      throw new BusinessRuleException(
        'No open cash session available for this expense',
        'NO_OPEN_CASH_SESSION',
      );
    }
    if (openSessions.length > 1) {
      throw new BusinessRuleException(
        'Multiple open cash sessions — specify which one received the money',
        'CASH_SESSION_SELECTION_REQUIRED',
        { candidates: openSessions.map((session) => ({ cashSessionId: session.id, branchId: session.branchId })) },
      );
    }
    return openSessions[0];
  }

  private async resolvePayerName(
    businessId: string,
    paymentSource: ExpensePaymentSource,
    payerEmployeeId: string | undefined,
    payerName: string | undefined,
  ): Promise<string | undefined> {
    if (paymentSource !== ExpensePaymentSource.PERSONAL_MONEY) {
      return undefined;
    }
    if (payerEmployeeId) {
      // Server-derived, not client-trusted: the employee's name at the time of the expense.
      const employee = await this.employeesService.findOne(businessId, payerEmployeeId);
      return `${employee.firstName} ${employee.lastName}`;
    }
    if (!payerName?.trim()) {
      throw new BusinessRuleException(
        'Personal-money expenses require identifying who paid (an employee or a name)',
        'PAYER_REQUIRED',
      );
    }
    return payerName;
  }
}
