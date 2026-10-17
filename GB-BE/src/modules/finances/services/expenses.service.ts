import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { BusinessRuleException, EntityNotFoundException } from '../../../common/exceptions';
import { PaginatedResult } from '../../../common/pagination/paginated-result.interface';
import { buildPaginationMeta } from '../../../common/pagination/pagination.util';
import { DbClient } from '../../../database/types/database.types';
import { TransactionService } from '../../../database/transaction.service';
import { AuditService } from '../../audit/services/audit.service';
import { CashMovementType } from '../../cash-sessions/domain/cash-session.interface';
import { CashSessionsService } from '../../cash-sessions/services/cash-sessions.service';
import { EmployeesService } from '../../employees/services/employees.service';
import { FundType } from '../../funds/domain/fund.types';
import { FundsService } from '../../funds/services/funds.service';
import { Supplier } from '../../suppliers/domain/supplier.interface';
import { SuppliersService } from '../../suppliers/services/suppliers.service';
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
import { resolveOpenCashSession } from './resolve-open-cash-session';
import { ExpenseMapper } from '../mappers/expense.mapper';
import { EXPENSES_REPOSITORY } from '../repositories/expenses.repository.interface';
import type { IExpensesRepository } from '../repositories/expenses.repository.interface';
import { ReimbursementsService } from './reimbursements.service';
import { SupplierPayablesService } from './supplier-payables.service';
import { ExpenseAttachmentsService } from './expense-attachments.service';

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
    private readonly suppliersService: SuppliersService,
    private readonly supplierPayablesService: SupplierPayablesService,
    private readonly attachmentsService: ExpenseAttachmentsService,
  ) {}

  async create(data: CreateExpenseData, actorUserId: string): Promise<Expense> {
    await this.categoriesService.assertUsable(data.businessId, data.category);
    const payerName = await this.resolvePayerName(
      data.businessId,
      data.paymentSource,
      data.payerEmployeeId,
      data.payerName,
    );
    const supplier = await this.resolveSupplier(data, actorUserId);
    const credit = data.paymentSource === ExpensePaymentSource.SUPPLIER_CREDIT ? this.creditTerms(data, supplier as Supplier) : null;
    // Resolved before anything is written: with several open sessions and none chosen, nothing happens.
    const initialPaymentSession = credit
      ? await this.supplierPayablesService.resolvePaymentSession(data.businessId, data.branchId, data.initialPayment)
      : null;

    const row = await this.transactionService.execute(async (client) => {
      const created = await this.expensesRepository.create({ ...data, supplierId: supplier?.id, payerName }, client);

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

      if (credit && supplier) {
        await this.supplierPayablesService.createForPurchase(
          {
            businessId: data.businessId,
            expenseId: created.id,
            supplierId: supplier.id,
            supplierName: supplier.name,
            branchId: data.branchId ?? null,
            originalAmount: data.amount,
            dueDate: credit.dueDate,
            initialPayment: data.initialPayment,
            initialPaymentSession,
            actorUserId,
          },
          client,
        );
      }

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
      newValues: {
        category: row.category,
        amount: row.amount,
        paymentSource: row.payment_source,
        supplierId: row.supplier_id,
        ...(credit ? { dueDate: credit.dueDate, initialPayment: data.initialPayment?.amount ?? 0 } : {}),
      },
    });
    const [enriched] = await this.enrich([ExpenseMapper.toDomain(row)]);
    return enriched;
  }

  async findAll(query: ExpenseQuery): Promise<PaginatedResult<Expense>> {
    const { rows, total } = await this.expensesRepository.findAll(query);
    return {
      data: await this.enrich(rows.map((row) => ExpenseMapper.toDomain(row))),
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

    if (expense.paymentSource === ExpensePaymentSource.SUPPLIER_CREDIT) {
      // Its money moves through supplier payments, each with its own source.
      throw new BusinessRuleException(
        'A purchase on credit has no single source to change — record payments against it instead',
        'SUPPLIER_CREDIT_NOT_RECLASSIFIABLE',
      );
    }

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
    const existing = await this.expensesRepository.findById(id, businessId);
    if (!existing) {
      throw new EntityNotFoundException('Expense', id);
    }
    const row = await this.transactionService.execute(async (client) => {
      if (existing.payment_source === ExpensePaymentSource.SUPPLIER_CREDIT) {
        // Refused (whole delete rolls back) once anything was paid on it.
        await this.supplierPayablesService.voidInTransaction(
          businessId,
          id,
          'Compra eliminada',
          actorUserId ?? '',
          client,
        );
      }
      return this.expensesRepository.softDelete(id, businessId, client);
    });
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
        const session = await resolveOpenCashSession(
          this.cashSessionsService,
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

  /** The supplier of the purchase, checked to belong to the business. Required for a purchase on credit. */
  private async resolveSupplier(data: CreateExpenseData, actorUserId: string): Promise<Supplier | null> {
    if (!data.supplierId && data.newSupplierName?.trim()) {
      return this.suppliersService.findOrCreateByName(data.businessId, data.newSupplierName, actorUserId);
    }
    if (!data.supplierId) {
      if (data.paymentSource === ExpensePaymentSource.SUPPLIER_CREDIT) {
        throw new BusinessRuleException('A purchase on credit needs a supplier', 'SUPPLIER_REQUIRED');
      }
      return null;
    }
    return this.suppliersService.findOne(data.businessId, data.supplierId);
  }

  /**
   * The due date of a purchase on credit (given, or the purchase date plus the
   * supplier's credit days), after checking that a payment made right away
   * leaves something owed — paid in full is a cash purchase, not credit.
   */
  private creditTerms(data: CreateExpenseData, supplier: Supplier): { dueDate?: string } {
    if (data.initialPayment && Math.round(data.initialPayment.amount * 100) >= Math.round(data.amount * 100)) {
      throw new BusinessRuleException(
        'The payment covers the whole purchase — record it as paid with that source instead of on credit',
        'INITIAL_PAYMENT_NOT_PARTIAL',
      );
    }
    if (data.dueDate) return { dueDate: data.dueDate };
    if (supplier.creditDays === null) return {};
    const purchaseDate = new Date(`${data.expenseDate.slice(0, 10)}T00:00:00Z`);
    purchaseDate.setUTCDate(purchaseDate.getUTCDate() + supplier.creditDays);
    return { dueDate: purchaseDate.toISOString().slice(0, 10) };
  }

  /** Adds each expense's supplier name and, for a purchase on credit, what's paid and owed. */
  private async enrich(expenses: Expense[]): Promise<Expense[]> {
    const supplierIds = [...new Set(expenses.map((e) => e.supplierId).filter((id): id is string => Boolean(id)))];
    const creditIds = expenses.filter((e) => e.paymentSource === ExpensePaymentSource.SUPPLIER_CREDIT).map((e) => e.id);
    const [names, payables, attachmentCounts] = await Promise.all([
      this.expensesRepository.findSupplierNames(supplierIds),
      this.supplierPayablesService.findByExpenseIds(creditIds),
      this.attachmentsService.countByExpenseIds(expenses.map((e) => e.id)),
    ]);
    const payableOf = new Map(payables.map((payable) => [payable.expenseId, payable]));
    return expenses.map((expense) => {
      const payable = payableOf.get(expense.id);
      return {
        ...expense,
        supplierName: expense.supplierId ? (names.get(expense.supplierId) ?? null) : null,
        attachmentCount: attachmentCounts.get(expense.id) ?? 0,
        payable: payable
          ? {
              id: payable.id,
              originalAmount: payable.originalAmount,
              paidAmount: payable.paidAmount,
              pendingAmount: payable.pendingAmount,
              dueDate: payable.dueDate,
              status: payable.status,
            }
          : null,
      };
    });
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
