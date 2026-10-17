import { BusinessRuleException } from '../../../common/exceptions';
import { CashMovementType } from '../../cash-sessions/domain/cash-session.interface';
import { FundType } from '../../funds/domain/fund.types';
import {
  SupplierPayableRow,
  SupplierPayableStatus,
  SupplierPaymentSource,
} from '../domain/supplier-payable.types';
import { SupplierPayablesService } from './supplier-payables.service';

describe('SupplierPayablesService', () => {
  const businessId = 'business-1';
  // Stand-in for the transaction's client: the mocks only check it is passed through.
  const tx = 'tx' as never;
  let repository: {
    create: jest.Mock;
    findById: jest.Mock;
    lockForPayment: jest.Mock;
    findByExpenseIds: jest.Mock;
    findByExpenseId: jest.Mock;
    findAll: jest.Mock;
    setStatus: jest.Mock;
    markVoided: jest.Mock;
    insertPayment: jest.Mock;
    setPaymentPointers: jest.Mock;
    findPayments: jest.Mock;
    countPayments: jest.Mock;
    getSummary: jest.Mock;
  };
  let cashSessionsService: { findOne: jest.Mock; findAllOpen: jest.Mock; recordMovementInTransaction: jest.Mock };
  let fundsService: { debit: jest.Mock };
  let service: SupplierPayablesService;

  function makeRow(overrides: Partial<SupplierPayableRow> = {}): SupplierPayableRow {
    return {
      id: 'payable-1',
      business_id: businessId,
      expense_id: 'expense-1',
      supplier_id: 'supplier-1',
      supplier_name: 'Pollos El Campo',
      original_amount: '800000.00',
      paid_amount: '300000.00',
      due_date: '2026-10-30',
      status: SupplierPayableStatus.PARTIALLY_PAID,
      expense_name: 'Pollo',
      expense_description: 'Pollo para la semana',
      expense_category: 'COGS',
      purchase_date: '2026-10-01',
      branch_id: 'branch-1',
      void_reason: null,
      created_at: new Date(),
      ...overrides,
    };
  }

  beforeEach(() => {
    repository = {
      create: jest.fn().mockResolvedValue('payable-1'),
      findById: jest.fn().mockResolvedValue(makeRow()),
      lockForPayment: jest.fn(),
      findByExpenseIds: jest.fn().mockResolvedValue([]),
      findByExpenseId: jest.fn().mockResolvedValue(makeRow({ paid_amount: '0', status: SupplierPayableStatus.PENDING })),
      findAll: jest.fn().mockResolvedValue([]),
      setStatus: jest.fn(),
      markVoided: jest.fn(),
      insertPayment: jest.fn(),
      setPaymentPointers: jest.fn(),
      findPayments: jest.fn().mockResolvedValue([]),
      countPayments: jest.fn().mockResolvedValue(0),
      getSummary: jest.fn(),
    };
    cashSessionsService = {
      findOne: jest.fn(),
      findAllOpen: jest.fn().mockResolvedValue([{ id: 'session-1', branchId: 'branch-1' }]),
      recordMovementInTransaction: jest.fn().mockResolvedValue({ id: 'movement-1' }),
    };
    fundsService = { debit: jest.fn().mockResolvedValue({ id: 'fund-movement-1' }) };
    service = new SupplierPayablesService(
      repository as never,
      cashSessionsService as never,
      fundsService as never,
      { execute: jest.fn((work: (client: unknown) => unknown) => work('tx')) } as never,
      { record: jest.fn() } as never,
    );
  });

  describe('createForPurchase', () => {
    const base = {
      businessId,
      expenseId: 'expense-1',
      supplierId: 'supplier-1',
      supplierName: 'Pollos El Campo',
      branchId: 'branch-1',
      originalAmount: 800000,
      dueDate: '2026-10-31',
      actorUserId: 'user-1',
    };

    it('creates the payable alone for a purchase fully on credit', async () => {
      await service.createForPurchase(base, tx);

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ originalAmount: 800000, dueDate: '2026-10-31' }),
        'tx',
      );
      expect(repository.insertPayment).not.toHaveBeenCalled();
      expect(repository.setStatus).not.toHaveBeenCalled();
    });

    it('pays the first part from the bank account and leaves it partially paid', async () => {
      await service.createForPurchase(
        { ...base, initialPayment: { amount: 300000, source: SupplierPaymentSource.BANK_ACCOUNT, paymentDate: '2026-10-01' } },
        tx,
      );

      expect(repository.insertPayment).toHaveBeenCalledWith(
        expect.objectContaining({ payableId: 'payable-1', amount: 300000, paymentDate: '2026-10-01' }),
        'tx',
      );
      expect(fundsService.debit).toHaveBeenCalledWith(
        expect.objectContaining({ fundType: FundType.BANK_ACCOUNT, amount: 300000, sourceType: 'SUPPLIER_PAYMENT' }),
      );
      expect(repository.setStatus).toHaveBeenCalledWith('payable-1', SupplierPayableStatus.PARTIALLY_PAID, 'tx');
    });

    it('pays the first part from the cash session as an expense movement', async () => {
      await service.createForPurchase(
        {
          ...base,
          initialPayment: { amount: 300000, source: SupplierPaymentSource.CASH_OPERATIONAL },
          initialPaymentSession: { id: 'session-1', branchId: 'branch-1' } as never,
        },
        tx,
      );

      expect(cashSessionsService.recordMovementInTransaction).toHaveBeenCalledWith(
        expect.objectContaining({ cashSessionId: 'session-1', movementType: CashMovementType.EXPENSE, amount: 300000 }),
        'tx',
      );
      expect(fundsService.debit).not.toHaveBeenCalled();
    });
  });

  describe('recordPayment', () => {
    it('pays off the rest and marks it paid', async () => {
      await service.recordPayment(
        businessId,
        'payable-1',
        { amount: 500000, source: SupplierPaymentSource.CASH_RESERVE },
        'user-1',
      );

      expect(repository.lockForPayment).toHaveBeenCalledWith('payable-1', businessId, 'tx');
      expect(fundsService.debit).toHaveBeenCalledWith(
        expect.objectContaining({ fundType: FundType.CASH_RESERVE, amount: 500000 }),
      );
      expect(repository.setStatus).toHaveBeenCalledWith('payable-1', SupplierPayableStatus.PAID, 'tx');
    });

    it('refuses to pay more than what is still owed', async () => {
      await expect(
        service.recordPayment(businessId, 'payable-1', { amount: 500001, source: SupplierPaymentSource.BANK_ACCOUNT }, 'user-1'),
      ).rejects.toThrow(BusinessRuleException);
      expect(repository.insertPayment).not.toHaveBeenCalled();
      expect(fundsService.debit).not.toHaveBeenCalled();
    });

    it('refuses to pay a voided payable', async () => {
      repository.findById.mockResolvedValue(makeRow({ status: SupplierPayableStatus.VOIDED }));

      await expect(
        service.recordPayment(businessId, 'payable-1', { amount: 1000, source: SupplierPaymentSource.BANK_ACCOUNT }, 'user-1'),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('takes a cash payment out of the only open session', async () => {
      await service.recordPayment(
        businessId,
        'payable-1',
        { amount: 200000, source: SupplierPaymentSource.CASH_OPERATIONAL },
        'user-1',
      );

      expect(cashSessionsService.recordMovementInTransaction).toHaveBeenCalledWith(
        expect.objectContaining({ cashSessionId: 'session-1', movementType: CashMovementType.EXPENSE, amount: 200000 }),
        'tx',
      );
      expect(repository.setStatus).toHaveBeenCalledWith('payable-1', SupplierPayableStatus.PARTIALLY_PAID, 'tx');
    });
  });

  describe('voidInTransaction', () => {
    it('voids a payable nothing was paid on', async () => {
      await service.voidInTransaction(businessId, 'expense-1', 'Compra eliminada', 'user-1', tx);

      expect(repository.markVoided).toHaveBeenCalledWith('payable-1', 'user-1', 'Compra eliminada', 'tx');
    });

    it('refuses once something was paid', async () => {
      repository.countPayments.mockResolvedValue(1);

      await expect(
        service.voidInTransaction(businessId, 'expense-1', 'Compra eliminada', 'user-1', tx),
      ).rejects.toThrow(BusinessRuleException);
      expect(repository.markVoided).not.toHaveBeenCalled();
    });
  });

  it('reports what is pending as the original amount minus what was paid', async () => {
    repository.findAll.mockResolvedValue([makeRow()]);

    const [payable] = await service.findAll({ businessId, openOnly: true });

    expect(payable.pendingAmount).toBe(500000);
    expect(payable.supplier).toEqual({ id: 'supplier-1', name: 'Pollos El Campo' });
  });
});
