import {
  BusinessRuleException,
  CashSessionClosedException,
  EntityNotFoundException,
  UnauthorizedOperationException,
} from '../../../common/exceptions';
import {
  CashMovementType,
  CashSessionRow,
  CashSessionStatus,
} from '../domain/cash-session.interface';
import { CashSessionsService } from './cash-sessions.service';

describe('CashSessionsService', () => {
  let repository: {
    create: jest.Mock;
    findById: jest.Mock;
    findOpenForBranch: jest.Mock;
    findAllOpen: jest.Mock;
    findAll: jest.Mock;
    addMovement: jest.Mock;
    updateMovementPaymentMethod: jest.Mock;
    findMovements: jest.Mock;
    getExpectedClosingAmount: jest.Mock;
    getExpectedTransferAmount: jest.Mock;
    close: jest.Mock;
    reopenForCorrection: jest.Mock;
  };
  let branchesService: { findOne: jest.Mock };
  let transactionService: { execute: jest.Mock };
  let auditService: { record: jest.Mock };
  let configService: { getOrThrow: jest.Mock };
  let service: CashSessionsService;

  const businessId = 'business-1';
  const branchId = 'branch-1';

  function makeRow(overrides: Partial<CashSessionRow> = {}): CashSessionRow {
    return {
      id: 'session-1',
      business_id: businessId,
      branch_id: branchId,
      opened_by: 'user-1',
      closed_by: null,
      opening_amount: '50000.00',
      expected_closing_amount: null,
      actual_closing_amount: null,
      difference_amount: null,
      expected_transfer_amount: null,
      actual_transfer_amount: null,
      transfer_difference_amount: null,
      status: CashSessionStatus.OPEN,
      opened_at: new Date(),
      closed_at: null,
      notes: null,
      ...overrides,
    };
  }

  beforeEach(() => {
    repository = {
      create: jest.fn(),
      findById: jest.fn(),
      findOpenForBranch: jest.fn(),
      findAllOpen: jest.fn().mockResolvedValue([]),
      findAll: jest.fn().mockResolvedValue({ rows: [], total: 0 }),
      addMovement: jest.fn(),
      updateMovementPaymentMethod: jest.fn(),
      findMovements: jest.fn().mockResolvedValue([]),
      getExpectedClosingAmount: jest.fn().mockResolvedValue(0),
      getExpectedTransferAmount: jest.fn().mockResolvedValue(0),
      close: jest.fn(),
      reopenForCorrection: jest.fn(),
    };
    branchesService = {
      findOne: jest.fn().mockResolvedValue({ id: branchId }),
    };
    transactionService = {
      execute: jest.fn((work: (client: unknown) => Promise<unknown>) =>
        work({}),
      ),
    };
    auditService = { record: jest.fn() };
    configService = {
      getOrThrow: jest
        .fn()
        .mockReturnValue({ cashSession: { masterKey: 'super-secret' } }),
    };
    service = new CashSessionsService(
      repository,
      branchesService as never,
      transactionService as never,
      auditService as never,
      configService as never,
      // The business's key, or the platform-wide one (from the config) when it has none.
      {
        keyFor: jest.fn(() =>
          Promise.resolve(
            (
              configService.getOrThrow() as {
                cashSession: { masterKey: string };
              }
            ).cashSession.masterKey || null,
          ),
        ),
      } as never,
    );
  });

  describe('open', () => {
    it('rejects opening a second session for a branch that already has one open', async () => {
      repository.findOpenForBranch.mockResolvedValue(makeRow());

      await expect(
        service.open({ businessId, branchId, openingAmount: 100 }, 'user-1'),
      ).rejects.toThrow(BusinessRuleException);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('skips the OPENING movement when openingAmount is 0', async () => {
      repository.findOpenForBranch.mockResolvedValue(null);
      repository.create.mockResolvedValue(makeRow({ opening_amount: '0.00' }));

      await service.open({ businessId, branchId, openingAmount: 0 }, 'user-1');

      expect(repository.addMovement).not.toHaveBeenCalled();
    });

    it('records an OPENING movement when openingAmount is positive', async () => {
      repository.findOpenForBranch.mockResolvedValue(null);
      repository.create.mockResolvedValue(makeRow());

      await service.open(
        { businessId, branchId, openingAmount: 50000 },
        'user-1',
      );

      expect(repository.addMovement).toHaveBeenCalledWith(
        expect.objectContaining({
          movementType: CashMovementType.OPENING,
          amount: 50000,
        }),
        expect.anything(),
      );
    });
  });

  describe('getOpenSessionOrFail', () => {
    it('throws CashSessionClosedException when no session is open', async () => {
      repository.findOpenForBranch.mockResolvedValue(null);

      await expect(
        service.getOpenSessionOrFail(businessId, branchId),
      ).rejects.toThrow(CashSessionClosedException);
    });
  });

  describe('findAllOpen', () => {
    it('delegates to the repository and maps every row', async () => {
      repository.findAllOpen.mockResolvedValue([
        makeRow(),
        makeRow({ id: 'session-2', branch_id: 'branch-2' }),
      ]);

      const sessions = await service.findAllOpen(businessId, undefined);

      expect(repository.findAllOpen).toHaveBeenCalledWith(
        businessId,
        undefined,
        undefined,
      );
      expect(sessions).toHaveLength(2);
      expect(sessions[1].id).toBe('session-2');
    });
  });

  describe('recordMovement', () => {
    it('rejects recording a movement on a closed session', async () => {
      repository.findById.mockResolvedValue(
        makeRow({ status: CashSessionStatus.CLOSED }),
      );

      await expect(
        service.recordMovement(
          businessId,
          'session-1',
          CashMovementType.EXPENSE,
          100,
          undefined,
        ),
      ).rejects.toThrow(CashSessionClosedException);
    });

    it('allows recording a movement on a RECTIFYING session (admin correction in progress)', async () => {
      repository.findById.mockResolvedValue(
        makeRow({ status: CashSessionStatus.RECTIFYING }),
      );
      repository.addMovement.mockResolvedValue({
        id: 'movement-1',
        cash_session_id: 'session-1',
        order_id: null,
        payment_id: null,
        movement_type: CashMovementType.EXPENSE,
        payment_method: null,
        amount: '100.00',
        description: null,
        created_by: null,
        created_at: new Date(),
      });

      await expect(
        service.recordMovement(
          businessId,
          'session-1',
          CashMovementType.EXPENSE,
          100,
          undefined,
        ),
      ).resolves.toBeDefined();
    });
  });

  describe('correctSaleMovementMethod', () => {
    it('delegates to the repository to retag the movement tied to that payment', async () => {
      await service.correctSaleMovementMethod('payment-1', 'CASH' as never);

      expect(repository.updateMovementPaymentMethod).toHaveBeenCalledWith(
        'payment-1',
        'CASH',
        undefined,
      );
    });
  });

  describe('close', () => {
    it('rejects closing an already-closed session', async () => {
      repository.findById.mockResolvedValue(
        makeRow({ status: CashSessionStatus.CLOSED }),
      );

      await expect(
        service.close(businessId, 'session-1', { actualClosingAmount: 50000 }),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('allows closing a RECTIFYING session (re-closing after an admin correction)', async () => {
      repository.findById.mockResolvedValue(
        makeRow({ status: CashSessionStatus.RECTIFYING }),
      );
      repository.close.mockResolvedValue(
        makeRow({ status: CashSessionStatus.CLOSED }),
      );

      await expect(
        service.close(businessId, 'session-1', { actualClosingAmount: 50000 }),
      ).resolves.toBeDefined();
    });

    it('computes the difference between actual and expected closing amounts', async () => {
      repository.findById.mockResolvedValue(makeRow());
      repository.getExpectedClosingAmount.mockResolvedValue(55000);
      repository.close.mockResolvedValue(
        makeRow({
          status: CashSessionStatus.CLOSED,
          expected_closing_amount: '55000.00',
          actual_closing_amount: '54000.00',
          difference_amount: '-1000.00',
        }),
      );

      const result = await service.close(businessId, 'session-1', {
        actualClosingAmount: 54000,
      });

      expect(repository.close).toHaveBeenCalledWith(
        'session-1',
        businessId,
        undefined,
        55000,
        54000,
        -1000,
        0,
        null,
        null,
        undefined,
        expect.anything(),
      );
      expect(result.differenceAmount).toBe(-1000);
    });

    it('computes the transfer difference only when an actual transfer amount is given', async () => {
      repository.findById.mockResolvedValue(makeRow());
      repository.getExpectedTransferAmount.mockResolvedValue(20000);
      repository.close.mockResolvedValue(
        makeRow({ status: CashSessionStatus.CLOSED }),
      );

      await service.close(businessId, 'session-1', {
        actualClosingAmount: 50000,
        actualTransferAmount: 18000,
      });

      expect(repository.close).toHaveBeenCalledWith(
        'session-1',
        businessId,
        undefined,
        0,
        50000,
        50000,
        20000,
        18000,
        -2000,
        undefined,
        expect.anything(),
      );
    });

    it('leaves actual/difference transfer amounts null when none is provided', async () => {
      repository.findById.mockResolvedValue(makeRow());
      repository.getExpectedTransferAmount.mockResolvedValue(20000);
      repository.close.mockResolvedValue(
        makeRow({ status: CashSessionStatus.CLOSED }),
      );

      await service.close(businessId, 'session-1', {
        actualClosingAmount: 50000,
      });

      expect(repository.close).toHaveBeenCalledWith(
        'session-1',
        businessId,
        undefined,
        0,
        50000,
        50000,
        20000,
        null,
        null,
        undefined,
        expect.anything(),
      );
    });

    it('throws EntityNotFoundException when the session vanished mid-transaction', async () => {
      repository.findById.mockResolvedValue(makeRow());
      repository.getExpectedClosingAmount.mockResolvedValue(0);
      repository.close.mockResolvedValue(null);

      await expect(
        service.close(businessId, 'session-1', { actualClosingAmount: 0 }),
      ).rejects.toThrow(EntityNotFoundException);
    });
  });

  describe('reopenForCorrection', () => {
    it('rejects when the session is not closed', async () => {
      repository.findById.mockResolvedValue(
        makeRow({ status: CashSessionStatus.OPEN }),
      );

      await expect(
        service.reopenForCorrection(
          businessId,
          'session-1',
          'super-secret',
          'Faltó un ingreso',
          'admin-1',
        ),
      ).rejects.toThrow(BusinessRuleException);
      expect(repository.reopenForCorrection).not.toHaveBeenCalled();
    });

    it('rejects when no master key is configured', async () => {
      configService.getOrThrow.mockReturnValue({
        cashSession: { masterKey: '' },
      });
      repository.findById.mockResolvedValue(
        makeRow({ status: CashSessionStatus.CLOSED }),
      );

      await expect(
        service.reopenForCorrection(
          businessId,
          'session-1',
          'anything',
          'Faltó un ingreso',
          'admin-1',
        ),
      ).rejects.toThrow(BusinessRuleException);
      expect(repository.reopenForCorrection).not.toHaveBeenCalled();
    });

    it('rejects an incorrect master key without reopening', async () => {
      repository.findById.mockResolvedValue(
        makeRow({ status: CashSessionStatus.CLOSED }),
      );

      await expect(
        service.reopenForCorrection(
          businessId,
          'session-1',
          'wrong-key',
          'Faltó un ingreso',
          'admin-1',
        ),
      ).rejects.toThrow(UnauthorizedOperationException);
      expect(repository.reopenForCorrection).not.toHaveBeenCalled();
    });

    it('rejects a master key of a different length than the configured one', async () => {
      repository.findById.mockResolvedValue(
        makeRow({ status: CashSessionStatus.CLOSED }),
      );

      await expect(
        service.reopenForCorrection(
          businessId,
          'session-1',
          'short',
          'Faltó un ingreso',
          'admin-1',
        ),
      ).rejects.toThrow(UnauthorizedOperationException);
    });

    it('reopens as RECTIFYING and audits the prior closing snapshot when the master key matches', async () => {
      const closedRow = makeRow({
        status: CashSessionStatus.CLOSED,
        closed_by: 'cashier-1',
        closed_at: new Date('2026-09-08T20:00:00Z'),
        actual_closing_amount: '48000.00',
        difference_amount: '-2000.00',
      });
      repository.findById.mockResolvedValue(closedRow);
      repository.reopenForCorrection.mockResolvedValue(
        makeRow({ status: CashSessionStatus.RECTIFYING }),
      );

      const result = await service.reopenForCorrection(
        businessId,
        'session-1',
        'super-secret',
        'Faltó registrar un ingreso de $50.000',
        'admin-1',
      );

      expect(repository.reopenForCorrection).toHaveBeenCalledWith(
        'session-1',
        businessId,
      );
      expect(result.status).toBe(CashSessionStatus.RECTIFYING);
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'cash_session',
          action: 'REOPEN_FOR_CORRECTION',
          userId: 'admin-1',
          oldValues: expect.objectContaining({
            status: CashSessionStatus.CLOSED,
            closedBy: 'cashier-1',
            actualClosingAmount: '48000.00',
            differenceAmount: '-2000.00',
          }),
          newValues: { status: CashSessionStatus.RECTIFYING },
          metadata: { reason: 'Faltó registrar un ingreso de $50.000' },
        }),
      );
    });

    it('throws EntityNotFoundException if the session was no longer CLOSED by the time it tried to claim it', async () => {
      repository.findById.mockResolvedValue(
        makeRow({ status: CashSessionStatus.CLOSED }),
      );
      repository.reopenForCorrection.mockResolvedValue(null);

      await expect(
        service.reopenForCorrection(
          businessId,
          'session-1',
          'super-secret',
          'Faltó un ingreso',
          'admin-1',
        ),
      ).rejects.toThrow(EntityNotFoundException);
    });
  });
});
