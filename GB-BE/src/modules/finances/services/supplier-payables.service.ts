import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { BusinessRuleException, EntityNotFoundException } from '../../../common/exceptions';
import { businessToday } from '../../../common/utils/business-day.util';
import { DbClient } from '../../../database/types/database.types';
import { TransactionService } from '../../../database/transaction.service';
import { AuditService } from '../../audit/services/audit.service';
import { CashMovementType, CashSession } from '../../cash-sessions/domain/cash-session.interface';
import { CashSessionsService } from '../../cash-sessions/services/cash-sessions.service';
import { FundType } from '../../funds/domain/fund.types';
import { FundsService } from '../../funds/services/funds.service';
import {
  SupplierPayable,
  SupplierPayableQuery,
  SupplierPayableRow,
  SupplierPayablesSummary,
  SupplierPayableStatus,
  SupplierPayableWithPayments,
  SupplierPaymentInput,
  SupplierPaymentSource,
} from '../domain/supplier-payable.types';
import { SupplierPayablesRepository } from '../repositories/supplier-payables.repository';
import { resolveOpenCashSession } from './resolve-open-cash-session';

/** Same default the orders module uses for "today"; the business's own timezone isn't on the request. */
const BUSINESS_TIMEZONE = 'America/Bogota';

/** Floating-point sums of NUMERIC(14,2) amounts: compare in cents. */
const cents = (value: number) => Math.round(value * 100);

function toDomain(row: SupplierPayableRow): SupplierPayable {
  const originalAmount = parseFloat(row.original_amount);
  const paidAmount = parseFloat(row.paid_amount);
  return {
    id: row.id,
    expenseId: row.expense_id,
    supplier: { id: row.supplier_id, name: row.supplier_name },
    purchase: {
      name: row.expense_name,
      description: row.expense_description,
      category: row.expense_category,
      date: row.purchase_date,
    },
    branchId: row.branch_id,
    originalAmount,
    paidAmount,
    pendingAmount: row.status === SupplierPayableStatus.VOIDED ? 0 : Math.max(0, (cents(originalAmount) - cents(paidAmount)) / 100),
    dueDate: row.due_date,
    status: row.status,
    voidReason: row.void_reason,
    createdAt: row.created_at,
  };
}

function statusFor(original: number, paid: number): SupplierPayableStatus {
  if (cents(paid) <= 0) return SupplierPayableStatus.PENDING;
  return cents(paid) >= cents(original) ? SupplierPayableStatus.PAID : SupplierPayableStatus.PARTIALLY_PAID;
}

export interface CreatePayableForPurchaseParams {
  businessId: string;
  expenseId: string;
  supplierId: string;
  supplierName: string;
  branchId: string | null;
  originalAmount: number;
  dueDate?: string;
  /** Case "partial": what was paid at purchase time, already validated (less than the total). */
  initialPayment?: SupplierPaymentInput;
  /** The open session that pays it, resolved beforehand when the initial payment is from the cash session. */
  initialPaymentSession?: CashSession | null;
  actorUserId: string;
}

/**
 * What the business owes its suppliers for purchases on credit. A payable is
 * created with the purchase; each payment takes money out of a real source
 * (the open cash session, the cash reserve or the bank account) and is what
 * the expense reports count, on the payment's date.
 */
@Injectable()
export class SupplierPayablesService {
  constructor(
    private readonly payablesRepository: SupplierPayablesRepository,
    private readonly cashSessionsService: CashSessionsService,
    private readonly fundsService: FundsService,
    private readonly transactionService: TransactionService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(query: SupplierPayableQuery): Promise<SupplierPayable[]> {
    const rows = await this.payablesRepository.findAll(query);
    return rows.map(toDomain);
  }

  async findOne(businessId: string, id: string): Promise<SupplierPayableWithPayments> {
    const row = await this.payablesRepository.findById(id, businessId);
    if (!row) throw new EntityNotFoundException('SupplierPayable', id);
    const payments = await this.payablesRepository.findPayments(id);
    return {
      ...toDomain(row),
      payments: payments.map((payment) => ({
        id: payment.id,
        amount: parseFloat(payment.amount),
        paymentDate: payment.payment_date,
        source: payment.source,
        notes: payment.notes,
        createdAt: payment.created_at,
      })),
    };
  }

  async findByExpenseIds(expenseIds: string[]): Promise<SupplierPayable[]> {
    const rows = await this.payablesRepository.findByExpenseIds(expenseIds);
    return rows.map(toDomain);
  }

  async getSummary(businessId: string): Promise<SupplierPayablesSummary> {
    const row = await this.payablesRepository.getSummary(businessId, businessToday(BUSINESS_TIMEZONE));
    return {
      pendingTotal: parseFloat(row.pending_total),
      openCount: parseInt(row.open_count, 10),
      overdueTotal: parseFloat(row.overdue_total),
      overdueCount: parseInt(row.overdue_count, 10),
    };
  }

  /** The cash session a payment would come out of — resolved before anything is written. */
  async resolvePaymentSession(
    businessId: string,
    branchId: string | undefined,
    payment: SupplierPaymentInput | undefined,
  ): Promise<CashSession | null> {
    if (!payment || payment.source !== SupplierPaymentSource.CASH_OPERATIONAL) return null;
    return resolveOpenCashSession(this.cashSessionsService, businessId, branchId, payment.cashSessionId);
  }

  /** Inside the purchase's transaction: the payable for it and, for a partial payment, that first payment. */
  async createForPurchase(params: CreatePayableForPurchaseParams, client: DbClient): Promise<void> {
    const payableId = await this.payablesRepository.create(
      {
        businessId: params.businessId,
        expenseId: params.expenseId,
        supplierId: params.supplierId,
        originalAmount: params.originalAmount,
        dueDate: params.dueDate,
      },
      client,
    );
    if (params.initialPayment) {
      await this.applyPayment(
        {
          businessId: params.businessId,
          payableId,
          supplierName: params.supplierName,
          branchId: params.branchId,
          payment: params.initialPayment,
          session: params.initialPaymentSession ?? null,
          actorUserId: params.actorUserId,
        },
        client,
      );
      await this.payablesRepository.setStatus(
        payableId,
        statusFor(params.originalAmount, params.initialPayment.amount),
        client,
      );
    }
  }

  async recordPayment(
    businessId: string,
    payableId: string,
    payment: SupplierPaymentInput,
    actorUserId: string,
  ): Promise<SupplierPayableWithPayments> {
    const existing = await this.payablesRepository.findById(payableId, businessId);
    if (!existing) throw new EntityNotFoundException('SupplierPayable', payableId);
    const session = await this.resolvePaymentSession(businessId, existing.branch_id ?? undefined, payment);

    await this.transactionService.execute(async (client) => {
      await this.payablesRepository.lockForPayment(payableId, businessId, client);
      const row = (await this.payablesRepository.findById(payableId, businessId, client)) as SupplierPayableRow;
      if (row.status === SupplierPayableStatus.VOIDED) {
        throw new BusinessRuleException('This payable was voided', 'PAYABLE_VOIDED');
      }
      const original = parseFloat(row.original_amount);
      const paid = parseFloat(row.paid_amount);
      if (cents(payment.amount) > cents(original) - cents(paid)) {
        throw new BusinessRuleException('The payment is more than what is still owed', 'PAYMENT_EXCEEDS_PENDING', {
          pendingAmount: (cents(original) - cents(paid)) / 100,
        });
      }

      await this.applyPayment(
        {
          businessId,
          payableId,
          supplierName: row.supplier_name,
          branchId: session?.branchId ?? row.branch_id,
          payment,
          session,
          actorUserId,
        },
        client,
      );
      await this.payablesRepository.setStatus(payableId, statusFor(original, paid + payment.amount), client);
    });

    await this.auditService.record({
      businessId,
      userId: actorUserId,
      entityType: 'supplier_payable',
      entityId: payableId,
      action: 'PAYMENT',
      newValues: { amount: payment.amount, source: payment.source, paymentDate: payment.paymentDate },
    });
    return this.findOne(businessId, payableId);
  }

  /** Only a payable nothing has been paid on can be voided: paid money already left its source. */
  async voidInTransaction(
    businessId: string,
    expenseId: string,
    reason: string,
    actorUserId: string,
    client: DbClient,
  ): Promise<void> {
    const row = await this.payablesRepository.findByExpenseId(expenseId, client);
    if (!row || row.business_id !== businessId || row.status === SupplierPayableStatus.VOIDED) return;
    if ((await this.payablesRepository.countPayments(row.id, client)) > 0) {
      throw new BusinessRuleException(
        'This purchase already has payments to the supplier, so it cannot be removed',
        'PURCHASE_HAS_PAYMENTS',
      );
    }
    await this.payablesRepository.markVoided(row.id, actorUserId, reason, client);
  }

  private async applyPayment(
    params: {
      businessId: string;
      payableId: string;
      supplierName: string;
      branchId: string | null;
      payment: SupplierPaymentInput;
      session: CashSession | null;
      actorUserId: string;
    },
    client: DbClient,
  ): Promise<void> {
    const { payment } = params;
    if (payment.amount <= 0) {
      throw new BusinessRuleException('Payment amount must be greater than zero', 'INVALID_AMOUNT');
    }
    const paymentId = randomUUID();
    await this.payablesRepository.insertPayment(
      {
        id: paymentId,
        payableId: params.payableId,
        businessId: params.businessId,
        branchId: params.session?.branchId ?? params.branchId,
        amount: payment.amount,
        paymentDate: payment.paymentDate ?? businessToday(BUSINESS_TIMEZONE),
        source: payment.source,
        notes: payment.notes,
        createdBy: params.actorUserId,
      },
      client,
    );

    const description = `Pago a proveedor: ${params.supplierName}`;
    if (payment.source === SupplierPaymentSource.CASH_OPERATIONAL) {
      const session = params.session as CashSession;
      const movement = await this.cashSessionsService.recordMovementInTransaction(
        {
          cashSessionId: session.id,
          movementType: CashMovementType.EXPENSE,
          amount: payment.amount,
          description,
          createdBy: params.actorUserId,
        },
        client,
      );
      await this.payablesRepository.setPaymentPointers(
        paymentId,
        { cashSessionId: session.id, cashMovementId: movement.id, fundMovementId: null },
        client,
      );
      return;
    }

    // Rejects (and rolls the whole payment back) if the fund doesn't have the money.
    const movement = await this.fundsService.debit({
      businessId: params.businessId,
      branchId: params.branchId ?? undefined,
      fundType: payment.source === SupplierPaymentSource.CASH_RESERVE ? FundType.CASH_RESERVE : FundType.BANK_ACCOUNT,
      amount: payment.amount,
      sourceType: 'SUPPLIER_PAYMENT',
      sourceId: paymentId,
      actorUserId: params.actorUserId,
      notes: description,
    });
    await this.payablesRepository.setPaymentPointers(
      paymentId,
      { cashSessionId: null, cashMovementId: null, fundMovementId: movement.id },
      client,
    );
  }
}
