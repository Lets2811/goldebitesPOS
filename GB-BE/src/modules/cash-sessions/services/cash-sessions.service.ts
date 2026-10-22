import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';
import {
  BusinessRuleException,
  CashSessionClosedException,
  EntityNotFoundException,
  UnauthorizedOperationException,
} from '../../../common/exceptions';
import { PaginatedResult } from '../../../common/pagination/paginated-result.interface';
import { buildPaginationMeta } from '../../../common/pagination/pagination.util';
import { DbClient } from '../../../database/types/database.types';
import { TransactionService } from '../../../database/transaction.service';
import { AuditService } from '../../audit/services/audit.service';
import { BranchesService } from '../../branches/services/branches.service';
import {
  CashMovement,
  CashMovementType,
  CashSession,
  CashSessionRow,
  CashSessionStatus,
  CashSessionWithMovements,
  PaymentMethod,
} from '../domain/cash-session.interface';
import {
  CashSessionQuery,
  CloseCashSessionData,
  OpenCashSessionData,
  RecordCashMovementData,
} from '../domain/cash-session.types';
import { CashSessionMapper } from '../mappers/cash-session.mapper';
import { CASH_SESSIONS_REPOSITORY } from '../repositories/cash-sessions.repository.interface';
import type { ICashSessionsRepository } from '../repositories/cash-sessions.repository.interface';

import { MasterKeysService } from './master-keys.service';

@Injectable()
export class CashSessionsService {
  constructor(
    @Inject(CASH_SESSIONS_REPOSITORY)
    private readonly sessionsRepository: ICashSessionsRepository,
    private readonly branchesService: BranchesService,
    private readonly transactionService: TransactionService,
    private readonly auditService: AuditService,
    private readonly configService: ConfigService,
    private readonly masterKeysService: MasterKeysService,
  ) {}

  async open(
    data: OpenCashSessionData,
    actorUserId: string,
  ): Promise<CashSession> {
    await this.branchesService.findOne(data.businessId, data.branchId);

    const existing = await this.sessionsRepository.findOpenForBranch(
      data.businessId,
      data.branchId,
    );
    if (existing) {
      throw new BusinessRuleException(
        'This branch already has an open cash session',
        'CASH_SESSION_ALREADY_OPEN',
      );
    }

    const row = await this.transactionService.execute(async (client) => {
      const created = await this.sessionsRepository.create(
        data,
        actorUserId,
        client,
      );
      if (data.openingAmount > 0) {
        await this.sessionsRepository.addMovement(
          {
            cashSessionId: created.id,
            movementType: CashMovementType.OPENING,
            amount: data.openingAmount,
            createdBy: actorUserId,
          },
          client,
        );
      }
      return created;
    });

    await this.auditService.record({
      businessId: data.businessId,
      branchId: data.branchId,
      userId: actorUserId,
      entityType: 'cash_session',
      entityId: row.id,
      action: 'OPEN',
      newValues: { openingAmount: data.openingAmount },
    });

    return CashSessionMapper.toDomain(row);
  }

  async findAll(
    query: CashSessionQuery,
  ): Promise<PaginatedResult<CashSession>> {
    const { rows, total } = await this.sessionsRepository.findAll(query);
    return {
      data: rows.map((row) => CashSessionMapper.toDomain(row)),
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  async findOne(
    businessId: string,
    id: string,
  ): Promise<CashSessionWithMovements> {
    const row = await this.getOwnedOrFail(businessId, id);
    return this.buildWithMovements(row);
  }

  async findCurrent(
    businessId: string,
    branchId: string,
  ): Promise<CashSessionWithMovements> {
    await this.branchesService.findOne(businessId, branchId);
    const row = await this.sessionsRepository.findOpenForBranch(
      businessId,
      branchId,
    );
    if (!row) {
      throw new EntityNotFoundException(
        'Open cash session for branch',
        branchId,
      );
    }
    return this.buildWithMovements(row);
  }

  /** Used by DashboardService: whether the branch currently has an open register. */
  async hasOpenSession(businessId: string, branchId: string): Promise<boolean> {
    const row = await this.sessionsRepository.findOpenForBranch(
      businessId,
      branchId,
    );
    return row !== null;
  }

  /** Used by PaymentsService: the open session a CASH payment must be logged against. */
  async getOpenSessionOrFail(
    businessId: string,
    branchId: string,
    client?: DbClient,
  ): Promise<CashSession> {
    const row = await this.sessionsRepository.findOpenForBranch(
      businessId,
      branchId,
      client,
    );
    if (!row) {
      throw new CashSessionClosedException();
    }
    return CashSessionMapper.toDomain(row);
  }

  /** Used by ExpensesService: every OPEN session for the business (optionally scoped to a branch), to resolve which one an expense drew from (BR-02/AC-02/AC-03/AC-04). */
  async findAllOpen(
    businessId: string,
    branchId?: string,
    client?: DbClient,
  ): Promise<CashSession[]> {
    const rows = await this.sessionsRepository.findAllOpen(
      businessId,
      branchId,
      client,
    );
    return rows.map((row) => CashSessionMapper.toDomain(row));
  }

  /** Used by PaymentsService: the branch's open session, if any, for non-CASH payments (which don't require one). */
  async findOpenSessionId(
    businessId: string,
    branchId: string,
  ): Promise<string | null> {
    const row = await this.sessionsRepository.findOpenForBranch(
      businessId,
      branchId,
    );
    return row?.id ?? null;
  }

  async recordMovement(
    businessId: string,
    cashSessionId: string,
    movementType: CashMovementType,
    amount: number,
    description: string | undefined,
    actorUserId?: string,
  ): Promise<CashMovement> {
    const session = await this.getOwnedOrFail(businessId, cashSessionId);
    if (session.status === CashSessionStatus.CLOSED) {
      throw new CashSessionClosedException(cashSessionId);
    }

    const row = await this.sessionsRepository.addMovement({
      cashSessionId,
      movementType,
      amount,
      description,
      createdBy: actorUserId,
    });

    await this.auditService.record({
      businessId,
      branchId: session.branch_id,
      userId: actorUserId,
      entityType: 'cash_movement',
      entityId: row.id,
      action: movementType,
      newValues: { amount },
    });

    return CashSessionMapper.movementToDomain(row);
  }

  /** Used by PaymentsService, inside the same transaction as recording the payment. */
  async recordSaleMovement(
    data: RecordCashMovementData,
    client?: DbClient,
  ): Promise<void> {
    await this.sessionsRepository.addMovement(data, client);
  }

  /**
   * Low-level movement insert for another module composing its own transaction
   * (e.g. a reimbursement payout, alongside its own ledger row and audit entry).
   * Unlike the standalone recordMovement(), this does not check session status
   * or write its own audit entry — the caller already validated the session
   * (e.g. via getOpenSessionOrFail in the same transaction) and owns the audit
   * trail for the operation as a whole, same as OPENING/CLOSING movements
   * created inside open()/close() don't get their own separate audit entry.
   */
  async recordMovementInTransaction(
    data: RecordCashMovementData,
    client: DbClient,
  ): Promise<CashMovement> {
    const row = await this.sessionsRepository.addMovement(data, client);
    return CashSessionMapper.movementToDomain(row);
  }

  /**
   * Used by PaymentsService when a payment's method is corrected after the fact — keeps the
   * cash session's expected-cash total accurate. A no-op if the payment never had a matching
   * movement (e.g. no cash session was open when it was originally recorded).
   */
  async correctSaleMovementMethod(
    paymentId: string,
    paymentMethod: PaymentMethod,
    client?: DbClient,
  ): Promise<void> {
    await this.sessionsRepository.updateMovementPaymentMethod(
      paymentId,
      paymentMethod,
      client,
    );
  }

  async close(
    businessId: string,
    id: string,
    data: CloseCashSessionData,
    actorUserId?: string,
  ): Promise<CashSession> {
    const session = await this.getOwnedOrFail(businessId, id);
    if (session.status === CashSessionStatus.CLOSED) {
      throw new BusinessRuleException(
        'This cash session is already closed',
        'CASH_SESSION_ALREADY_CLOSED',
      );
    }

    const row = await this.transactionService.execute(async (client) => {
      const expected = await this.sessionsRepository.getExpectedClosingAmount(
        id,
        client,
      );
      const difference = round2(data.actualClosingAmount - expected);

      const expectedTransfer =
        await this.sessionsRepository.getExpectedTransferAmount(id, client);
      const transferDifference =
        data.actualTransferAmount !== undefined
          ? round2(data.actualTransferAmount - expectedTransfer)
          : null;

      const closed = await this.sessionsRepository.close(
        id,
        businessId,
        actorUserId,
        expected,
        data.actualClosingAmount,
        difference,
        expectedTransfer,
        data.actualTransferAmount ?? null,
        transferDifference,
        data.notes,
        client,
      );
      if (!closed) {
        throw new EntityNotFoundException('CashSession', id);
      }

      if (data.actualClosingAmount > 0) {
        await this.sessionsRepository.addMovement(
          {
            cashSessionId: id,
            movementType: CashMovementType.CLOSING,
            amount: data.actualClosingAmount,
            createdBy: actorUserId,
          },
          client,
        );
      }

      return closed;
    });

    await this.auditService.record({
      businessId,
      branchId: session.branch_id,
      userId: actorUserId,
      entityType: 'cash_session',
      entityId: id,
      action: 'CLOSE',
      newValues: {
        expectedClosingAmount: row.expected_closing_amount,
        actualClosingAmount: row.actual_closing_amount,
        differenceAmount: row.difference_amount,
        expectedTransferAmount: row.expected_transfer_amount,
        actualTransferAmount: row.actual_transfer_amount,
        transferDifferenceAmount: row.transfer_difference_amount,
      },
    });

    return CashSessionMapper.toDomain(row);
  }

  /**
   * Admin-only "rectificar caja": reopens a CLOSED session as RECTIFYING so a missing
   * adjustment can be added and the session closed again — without touching whatever
   * session is currently OPEN for the branch today. Gated by the business's master
   * key (see MasterKeysService; the platform-wide CASH_SESSION_MASTER_KEY while the
   * business has none) on top of the cash.reopen permission.
   */
  async reopenForCorrection(
    businessId: string,
    id: string,
    masterKey: string,
    reason: string,
    actorUserId: string,
  ): Promise<CashSession> {
    const session = await this.getOwnedOrFail(businessId, id);
    if (session.status !== CashSessionStatus.CLOSED) {
      throw new BusinessRuleException(
        'This cash session is not closed',
        'CASH_SESSION_NOT_CLOSED',
      );
    }

    const configuredKey = await this.masterKeysService.keyFor(businessId);
    if (!configuredKey) {
      throw new BusinessRuleException(
        'Esta empresa no tiene clave maestra. Pídesela al equipo de Golden Bites.',
        'MASTER_KEY_NOT_CONFIGURED',
      );
    }
    if (!constantTimeEquals(masterKey, configuredKey)) {
      throw new UnauthorizedOperationException('Clave maestra incorrecta');
    }

    const reopened = await this.sessionsRepository.reopenForCorrection(
      id,
      businessId,
    );
    if (!reopened) {
      throw new EntityNotFoundException('CashSession', id);
    }

    await this.auditService.record({
      businessId,
      branchId: session.branch_id,
      userId: actorUserId,
      entityType: 'cash_session',
      entityId: id,
      action: 'REOPEN_FOR_CORRECTION',
      oldValues: {
        status: session.status,
        closedAt: session.closed_at,
        closedBy: session.closed_by,
        actualClosingAmount: session.actual_closing_amount,
        differenceAmount: session.difference_amount,
        actualTransferAmount: session.actual_transfer_amount,
        transferDifferenceAmount: session.transfer_difference_amount,
      },
      newValues: { status: reopened.status },
      metadata: { reason },
    });

    return CashSessionMapper.toDomain(reopened);
  }

  private async buildWithMovements(
    row: CashSessionRow,
  ): Promise<CashSessionWithMovements> {
    const movementRows = await this.sessionsRepository.findMovements(row.id);
    return {
      ...CashSessionMapper.toDomain(row),
      movements: movementRows.map((movementRow) =>
        CashSessionMapper.movementToDomain(movementRow),
      ),
    };
  }

  private async getOwnedOrFail(
    businessId: string,
    id: string,
  ): Promise<CashSessionRow> {
    const row = await this.sessionsRepository.findById(id, businessId);
    if (!row) {
      throw new EntityNotFoundException('CashSession', id);
    }
    return row;
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Constant-time string comparison so a wrong master key can't be brute-forced via response timing. */
function constantTimeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}
