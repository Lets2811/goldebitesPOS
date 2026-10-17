import { BusinessRuleException } from '../../../common/exceptions';
import { CashMovementType, CashSessionStatus, PaymentMethod } from '../../cash-sessions/domain/cash-session.interface';
import { FundType } from '../../funds/domain/fund.types';
import {
  OtherIncomeDestination,
  OtherIncomePaymentMethod,
  OtherIncomeRow,
  OtherIncomeType,
} from '../domain/other-income.types';
import { OtherIncomesService } from './other-incomes.service';

describe('OtherIncomesService', () => {
  const businessId = 'business-1';
  const input = {
    businessId,
    branchId: 'branch-1',
    incomeType: OtherIncomeType.SUPPLIER_REFUND,
    description: 'Devolución por pedido incompleto',
    receivedFrom: 'Distribuidora La Fortuna',
    amount: 85000,
    incomeDate: '2026-10-14',
  };

  let repository: { create: jest.Mock; setPointers: jest.Mock; findById: jest.Mock; findAll: jest.Mock; markVoided: jest.Mock };
  let cashSessionsService: { findOne: jest.Mock; findAllOpen: jest.Mock; recordMovementInTransaction: jest.Mock };
  let fundsService: { credit: jest.Mock; debit: jest.Mock };
  let service: OtherIncomesService;

  function makeRow(overrides: Partial<OtherIncomeRow> = {}): OtherIncomeRow {
    return {
      id: 'income-1',
      business_id: businessId,
      branch_id: 'branch-1',
      income_type: OtherIncomeType.SUPPLIER_REFUND,
      description: input.description,
      received_from: input.receivedFrom,
      amount: '85000.00',
      income_date: '2026-10-14',
      destination: OtherIncomeDestination.CASH_OPERATIONAL,
      payment_method: OtherIncomePaymentMethod.CASH,
      cash_session_id: 'session-1',
      cash_movement_id: 'movement-1',
      fund_movement_id: null,
      notes: null,
      created_by: 'user-1',
      created_at: new Date(),
      voided_at: null,
      void_reason: null,
      ...overrides,
    };
  }

  beforeEach(() => {
    repository = {
      create: jest.fn().mockResolvedValue(makeRow({ cash_session_id: null, cash_movement_id: null })),
      setPointers: jest.fn().mockImplementation((_id, pointers) =>
        Promise.resolve(
          makeRow({
            cash_session_id: pointers.cashSessionId,
            cash_movement_id: pointers.cashMovementId,
            fund_movement_id: pointers.fundMovementId,
          }),
        ),
      ),
      findById: jest.fn().mockResolvedValue(makeRow()),
      findAll: jest.fn().mockResolvedValue([]),
      markVoided: jest.fn().mockResolvedValue(makeRow({ voided_at: new Date(), void_reason: 'Error de registro' })),
    };
    cashSessionsService = {
      findOne: jest.fn().mockResolvedValue({ id: 'session-1', branchId: 'branch-1', status: CashSessionStatus.OPEN }),
      findAllOpen: jest.fn().mockResolvedValue([{ id: 'session-1', branchId: 'branch-1', status: CashSessionStatus.OPEN }]),
      recordMovementInTransaction: jest.fn().mockResolvedValue({ id: 'movement-1' }),
    };
    fundsService = {
      credit: jest.fn().mockResolvedValue({ id: 'fund-movement-1' }),
      debit: jest.fn().mockResolvedValue({ id: 'fund-movement-2' }),
    };
    service = new OtherIncomesService(
      repository as never,
      cashSessionsService as never,
      fundsService as never,
      { execute: jest.fn((work: (client: unknown) => unknown) => work('tx')) } as never,
      { record: jest.fn() } as never,
    );
  });

  describe('create', () => {
    it("puts money received into the cash session as an INCOME movement", async () => {
      const income = await service.create({ ...input, destination: OtherIncomeDestination.CASH_OPERATIONAL, paymentMethod: OtherIncomePaymentMethod.CASH }, 'user-1');

      expect(cashSessionsService.recordMovementInTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          cashSessionId: 'session-1',
          movementType: CashMovementType.INCOME,
          paymentMethod: PaymentMethod.CASH,
          amount: 85000,
        }),
        'tx',
      );
      expect(fundsService.credit).not.toHaveBeenCalled();
      expect(income.cashSessionId).toBe('session-1');
    });

    it('records a transfer into the session as a transfer, not as cash', async () => {
      await service.create(
        { ...input, destination: OtherIncomeDestination.CASH_OPERATIONAL, paymentMethod: OtherIncomePaymentMethod.TRANSFER },
        'user-1',
      );

      expect(cashSessionsService.recordMovementInTransaction).toHaveBeenCalledWith(
        expect.objectContaining({ movementType: CashMovementType.INCOME, paymentMethod: PaymentMethod.TRANSFER }),
        'tx',
      );
    });

    it('refuses money into the session without saying whether it was cash or a transfer', async () => {
      await expect(
        service.create({ ...input, destination: OtherIncomeDestination.CASH_OPERATIONAL }, 'user-1'),
      ).rejects.toThrow(BusinessRuleException);
      expect(cashSessionsService.findAllOpen).not.toHaveBeenCalled();
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('credits the bank account fund', async () => {
      await service.create({ ...input, destination: OtherIncomeDestination.BANK_ACCOUNT }, 'user-1');

      expect(fundsService.credit).toHaveBeenCalledWith(
        expect.objectContaining({
          fundType: FundType.BANK_ACCOUNT,
          amount: 85000,
          sourceType: 'OTHER_INCOME',
          sourceId: 'income-1',
        }),
      );
      expect(repository.setPointers).toHaveBeenCalledWith(
        'income-1',
        { cashSessionId: null, cashMovementId: null, fundMovementId: 'fund-movement-1' },
        'tx',
      );
      expect(cashSessionsService.recordMovementInTransaction).not.toHaveBeenCalled();
    });

    it('credits the cash reserve fund', async () => {
      await service.create({ ...input, destination: OtherIncomeDestination.CASH_RESERVE }, 'user-1');

      expect(fundsService.credit).toHaveBeenCalledWith(expect.objectContaining({ fundType: FundType.CASH_RESERVE }));
    });

    it('records nothing when several sessions are open and none was chosen', async () => {
      cashSessionsService.findAllOpen.mockResolvedValue([
        { id: 'session-1', branchId: 'branch-1' },
        { id: 'session-2', branchId: 'branch-2' },
      ]);

      await expect(
        service.create({ ...input, destination: OtherIncomeDestination.CASH_OPERATIONAL, paymentMethod: OtherIncomePaymentMethod.CASH }, 'user-1'),
      ).rejects.toThrow(BusinessRuleException);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it("files money for a chosen session under that session's branch", async () => {
      cashSessionsService.findOne.mockResolvedValue({ id: 'session-2', branchId: 'branch-2', status: CashSessionStatus.OPEN });

      await service.create(
        {
          ...input,
          destination: OtherIncomeDestination.CASH_OPERATIONAL,
          paymentMethod: OtherIncomePaymentMethod.CASH,
          cashSessionId: 'session-2',
        },
        'user-1',
      );

      expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({ branchId: 'branch-2' }), 'user-1', 'tx');
    });
  });

  describe('void', () => {
    it('takes cash back out of its still-open session', async () => {
      const income = await service.void(businessId, 'income-1', 'Error de registro', 'user-1');

      expect(cashSessionsService.recordMovementInTransaction).toHaveBeenCalledWith(
        expect.objectContaining({ cashSessionId: 'session-1', movementType: CashMovementType.INCOME_REVERSAL, amount: 85000 }),
        'tx',
      );
      expect(income.voidedAt).not.toBeNull();
    });

    it('takes a transfer back out of the transfers, the same count it went into', async () => {
      repository.findById.mockResolvedValue(makeRow({ payment_method: OtherIncomePaymentMethod.TRANSFER }));

      await service.void(businessId, 'income-1', 'Error de registro', 'user-1');

      expect(cashSessionsService.recordMovementInTransaction).toHaveBeenCalledWith(
        expect.objectContaining({ movementType: CashMovementType.INCOME_REVERSAL, paymentMethod: PaymentMethod.TRANSFER }),
        'tx',
      );
    });

    it('refuses once the session it went into has closed', async () => {
      cashSessionsService.findOne.mockResolvedValue({ id: 'session-1', status: CashSessionStatus.CLOSED });

      await expect(service.void(businessId, 'income-1', 'Error', 'user-1')).rejects.toThrow(BusinessRuleException);
      expect(repository.markVoided).not.toHaveBeenCalled();
    });

    it('debits the fund it credited', async () => {
      repository.findById.mockResolvedValue(
        makeRow({ destination: OtherIncomeDestination.BANK_ACCOUNT, cash_session_id: null, cash_movement_id: null }),
      );

      await service.void(businessId, 'income-1', 'Error de registro', 'user-1');

      expect(fundsService.debit).toHaveBeenCalledWith(
        expect.objectContaining({ fundType: FundType.BANK_ACCOUNT, amount: 85000, sourceType: 'OTHER_INCOME_VOID' }),
      );
    });

    it('does not void twice', async () => {
      repository.findById.mockResolvedValue(makeRow({ voided_at: new Date(), void_reason: 'x' }));

      await expect(service.void(businessId, 'income-1', 'Otra vez', 'user-1')).rejects.toThrow(BusinessRuleException);
      expect(cashSessionsService.recordMovementInTransaction).not.toHaveBeenCalled();
    });
  });
});
