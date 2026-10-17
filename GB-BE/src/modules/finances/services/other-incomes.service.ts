import { Injectable } from '@nestjs/common';
import { BusinessRuleException, EntityNotFoundException } from '../../../common/exceptions';
import { TransactionService } from '../../../database/transaction.service';
import { AuditService } from '../../audit/services/audit.service';
import { CashMovementType, CashSessionStatus, PaymentMethod } from '../../cash-sessions/domain/cash-session.interface';
import { CashSessionsService } from '../../cash-sessions/services/cash-sessions.service';
import { FundType } from '../../funds/domain/fund.types';
import { FundsService } from '../../funds/services/funds.service';
import {
  CreateOtherIncomeData,
  OtherIncome,
  OtherIncomeDestination,
  OtherIncomePointers,
  OtherIncomeQuery,
  OtherIncomeRow,
} from '../domain/other-income.types';
import { OtherIncomesRepository } from '../repositories/other-incomes.repository';
import { resolveOpenCashSession } from './resolve-open-cash-session';

const FUND_OF: Partial<Record<OtherIncomeDestination, FundType>> = {
  [OtherIncomeDestination.CASH_RESERVE]: FundType.CASH_RESERVE,
  [OtherIncomeDestination.BANK_ACCOUNT]: FundType.BANK_ACCOUNT,
};

function toDomain(row: OtherIncomeRow): OtherIncome {
  return {
    id: row.id,
    branchId: row.branch_id,
    incomeType: row.income_type,
    description: row.description,
    receivedFrom: row.received_from,
    amount: parseFloat(row.amount),
    incomeDate: row.income_date,
    destination: row.destination,
    paymentMethod: row.payment_method,
    cashSessionId: row.cash_session_id,
    notes: row.notes,
    createdAt: row.created_at,
    voidedAt: row.voided_at,
    voidReason: row.void_reason,
  };
}

/**
 * "Otros ingresos": money that comes in outside of sales. Recording one puts
 * the money in its destination right away — the open cash session or a fund
 * — and voiding it takes the money back out, so balances always match what
 * was recorded. The mirror image of ExpensesService's payment sources.
 */
@Injectable()
export class OtherIncomesService {
  constructor(
    private readonly otherIncomesRepository: OtherIncomesRepository,
    private readonly cashSessionsService: CashSessionsService,
    private readonly fundsService: FundsService,
    private readonly transactionService: TransactionService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(query: OtherIncomeQuery): Promise<OtherIncome[]> {
    const rows = await this.otherIncomesRepository.findAll(query);
    return rows.map(toDomain);
  }

  async create(data: CreateOtherIncomeData, actorUserId: string): Promise<OtherIncome> {
    // A session reconciles cash and transfers apart: it can't assume which one this was.
    if (data.destination === OtherIncomeDestination.CASH_OPERATIONAL && !data.paymentMethod) {
      throw new BusinessRuleException(
        'Say whether the money came in cash or by transfer',
        'PAYMENT_METHOD_REQUIRED',
      );
    }
    // Resolved before anything is written: with several open sessions and none chosen, nothing happens.
    const session =
      data.destination === OtherIncomeDestination.CASH_OPERATIONAL
        ? await resolveOpenCashSession(this.cashSessionsService, data.businessId, data.branchId, data.cashSessionId)
        : null;
    // Money put in a session belongs to that session's branch.
    const branchId = session?.branchId ?? data.branchId;

    const row = await this.transactionService.execute(async (client) => {
      const created = await this.otherIncomesRepository.create({ ...data, branchId }, actorUserId, client);

      let pointers: OtherIncomePointers;
      if (session) {
        const movement = await this.cashSessionsService.recordMovementInTransaction(
          {
            cashSessionId: session.id,
            movementType: CashMovementType.INCOME,
            paymentMethod: data.paymentMethod as unknown as PaymentMethod,
            amount: data.amount,
            description: `Otro ingreso: ${data.description}`,
            createdBy: actorUserId,
          },
          client,
        );
        pointers = { cashSessionId: session.id, cashMovementId: movement.id, fundMovementId: null };
      } else {
        const movement = await this.fundsService.credit({
          businessId: data.businessId,
          branchId,
          fundType: FUND_OF[data.destination] as FundType,
          amount: data.amount,
          sourceType: 'OTHER_INCOME',
          sourceId: created.id,
          actorUserId,
          notes: data.description,
        });
        pointers = { cashSessionId: null, cashMovementId: null, fundMovementId: movement.id };
      }

      return this.otherIncomesRepository.setPointers(created.id, pointers, client);
    });

    await this.auditService.record({
      businessId: data.businessId,
      branchId,
      userId: actorUserId,
      entityType: 'other_income',
      entityId: row.id,
      action: 'CREATE',
      newValues: {
        incomeType: row.income_type,
        amount: data.amount,
        destination: row.destination,
        paymentMethod: row.payment_method,
      },
    });
    return toDomain(row);
  }

  /**
   * Takes the money back out of where it went and keeps the income, marked
   * voided. Money that went into a cash session can only come back out while
   * that session is open: a closed session's count is final.
   */
  async void(businessId: string, id: string, reason: string, actorUserId: string): Promise<OtherIncome> {
    const existing = await this.otherIncomesRepository.findById(id, businessId);
    if (!existing) throw new EntityNotFoundException('OtherIncome', id);
    if (existing.voided_at) {
      throw new BusinessRuleException('This income was already voided', 'OTHER_INCOME_ALREADY_VOIDED');
    }

    if (existing.destination === OtherIncomeDestination.CASH_OPERATIONAL) {
      const session = await this.cashSessionsService.findOne(businessId, existing.cash_session_id as string);
      if (session.status !== CashSessionStatus.OPEN) {
        throw new BusinessRuleException(
          'The cash session this income went into is already closed',
          'OTHER_INCOME_SESSION_CLOSED',
        );
      }
    }

    const row = await this.transactionService.execute(async (client) => {
      const voided = await this.otherIncomesRepository.markVoided(id, businessId, actorUserId, reason, client);
      if (!voided) {
        throw new BusinessRuleException('This income was already voided', 'OTHER_INCOME_ALREADY_VOIDED');
      }

      if (existing.destination === OtherIncomeDestination.CASH_OPERATIONAL) {
        await this.cashSessionsService.recordMovementInTransaction(
          {
            cashSessionId: existing.cash_session_id as string,
            movementType: CashMovementType.INCOME_REVERSAL,
            // Comes back out of the same count it went into (cash or transfers).
            paymentMethod: (existing.payment_method ?? 'CASH') as unknown as PaymentMethod,
            amount: parseFloat(existing.amount),
            description: `Anulación de ingreso: ${reason}`,
            createdBy: actorUserId,
          },
          client,
        );
      } else {
        // Rejects (and rolls the void back) if the fund no longer has that much.
        await this.fundsService.debit({
          businessId,
          branchId: existing.branch_id ?? undefined,
          fundType: FUND_OF[existing.destination] as FundType,
          amount: parseFloat(existing.amount),
          sourceType: 'OTHER_INCOME_VOID',
          sourceId: id,
          actorUserId,
          notes: reason,
        });
      }
      return voided;
    });

    await this.auditService.record({
      businessId,
      branchId: existing.branch_id ?? undefined,
      userId: actorUserId,
      entityType: 'other_income',
      entityId: id,
      action: 'VOID',
      metadata: { reason },
    });
    return toDomain(row);
  }
}
