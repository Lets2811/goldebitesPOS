import {
  BusinessRuleException,
  ConflictException,
  EntityNotFoundException,
} from '../../../common/exceptions';
import { BranchRow, PaymentPolicy } from '../domain/branch.interface';
import { BranchesService } from './branches.service';

describe('BranchesService', () => {
  let branchesRepository: {
    create: jest.Mock;
    findById: jest.Mock;
    findAll: jest.Mock;
    update: jest.Mock;
    setActive: jest.Mock;
    setPaymentPolicy: jest.Mock;
    findActiveIds: jest.Mock;
    delete: jest.Mock;
    existsByName: jest.Mock;
  };
  let auditService: { record: jest.Mock };
  let service: BranchesService;

  const businessId = 'business-1';

  function makeBranchRow(overrides: Partial<BranchRow> = {}): BranchRow {
    return {
      id: 'branch-1',
      business_id: businessId,
      name: 'Sede Principal',
      address: null,
      city: null,
      phone: null,
      table_count: 20,
      is_active: true,
      payment_policy: PaymentPolicy.PAY_AT_END,
      created_at: new Date(),
      updated_at: new Date(),
      ...overrides,
    };
  }

  beforeEach(() => {
    branchesRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
      update: jest.fn(),
      setActive: jest.fn(),
      setPaymentPolicy: jest.fn(),
      findActiveIds: jest.fn().mockResolvedValue(['branch-1', 'branch-2']),
      delete: jest.fn().mockResolvedValue(true),
      existsByName: jest.fn(),
    };
    auditService = { record: jest.fn() };
    service = new BranchesService(branchesRepository, auditService as never);
  });

  describe('create', () => {
    it('creates a branch when the name is free within the business', async () => {
      branchesRepository.existsByName.mockResolvedValue(false);
      branchesRepository.create.mockResolvedValue(makeBranchRow());

      const branch = await service.create({
        businessId,
        name: 'Sede Principal',
      });

      expect(branch.name).toBe('Sede Principal');
    });

    it('rejects a duplicate branch name within the same business', async () => {
      branchesRepository.existsByName.mockResolvedValue(true);

      await expect(
        service.create({ businessId, name: 'Sede Principal' }),
      ).rejects.toThrow(ConflictException);
      expect(branchesRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('returns a paginated result built from the repository total', async () => {
      branchesRepository.findAll.mockResolvedValue({
        rows: [makeBranchRow()],
        total: 1,
      });

      const result = await service.findAll({ businessId, page: 1, limit: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual(
        expect.objectContaining({
          total: 1,
          page: 1,
          limit: 20,
          totalPages: 1,
        }),
      );
    });
  });

  describe('setActive', () => {
    it('throws EntityNotFoundException when the branch is not owned by the business', async () => {
      branchesRepository.findById.mockResolvedValue(null);

      await expect(
        service.setActive(businessId, 'branch-1', false),
      ).rejects.toThrow(EntityNotFoundException);
    });
  });

  describe('findOnlyActiveBranchId', () => {
    it('returns the branch of a business that has exactly one active', async () => {
      branchesRepository.findActiveIds.mockResolvedValue(['branch-1']);

      expect(await service.findOnlyActiveBranchId(businessId)).toBe('branch-1');
    });

    it('returns null for a business with several active branches, or none', async () => {
      branchesRepository.findActiveIds.mockResolvedValue([
        'branch-1',
        'branch-2',
      ]);
      expect(await service.findOnlyActiveBranchId(businessId)).toBeNull();

      branchesRepository.findActiveIds.mockResolvedValue([]);
      expect(await service.findOnlyActiveBranchId(businessId)).toBeNull();
    });
  });

  describe('keeping one active branch', () => {
    it('refuses to deactivate the last active branch', async () => {
      branchesRepository.findById.mockResolvedValue(makeBranchRow());
      branchesRepository.findActiveIds.mockResolvedValue(['branch-1']);

      await expect(
        service.setActive(businessId, 'branch-1', false),
      ).rejects.toThrow(BusinessRuleException);
      expect(branchesRepository.setActive).not.toHaveBeenCalled();
    });

    it('deactivates a branch when another stays active', async () => {
      branchesRepository.findById.mockResolvedValue(makeBranchRow());
      branchesRepository.setActive.mockResolvedValue(
        makeBranchRow({ is_active: false }),
      );

      const branch = await service.setActive(businessId, 'branch-1', false);

      expect(branch.isActive).toBe(false);
    });

    it('refuses to delete the last active branch', async () => {
      branchesRepository.findById.mockResolvedValue(makeBranchRow());
      branchesRepository.findActiveIds.mockResolvedValue(['branch-1']);

      await expect(service.remove(businessId, 'branch-1')).rejects.toThrow(
        BusinessRuleException,
      );
      expect(branchesRepository.delete).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('deletes an unused branch and records it', async () => {
      branchesRepository.findById.mockResolvedValue(
        makeBranchRow({ id: 'branch-2', name: 'Sede Norte' }),
      );

      await service.remove(businessId, 'branch-2', 'actor-1');

      expect(branchesRepository.delete).toHaveBeenCalledWith(
        'branch-2',
        businessId,
      );
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'DELETE', entityId: 'branch-2' }),
      );
    });

    it('explains that a branch with records has to be deactivated instead', async () => {
      branchesRepository.findById.mockResolvedValue(
        makeBranchRow({ id: 'branch-2' }),
      );
      branchesRepository.delete.mockRejectedValue(
        Object.assign(new Error('fk'), { code: '23503' }),
      );

      await expect(service.remove(businessId, 'branch-2')).rejects.toThrow(
        ConflictException,
      );
      expect(auditService.record).not.toHaveBeenCalled();
    });
  });

  describe('setPaymentPolicy', () => {
    it('updates the policy and records the old/new values in the audit trail', async () => {
      branchesRepository.findById.mockResolvedValue(
        makeBranchRow({ payment_policy: PaymentPolicy.PAY_AT_END }),
      );
      branchesRepository.setPaymentPolicy.mockResolvedValue(
        makeBranchRow({ payment_policy: PaymentPolicy.PREPAY_REQUIRED }),
      );

      const result = await service.setPaymentPolicy(
        businessId,
        'branch-1',
        PaymentPolicy.PREPAY_REQUIRED,
        'user-1',
      );

      expect(branchesRepository.setPaymentPolicy).toHaveBeenCalledWith(
        'branch-1',
        businessId,
        PaymentPolicy.PREPAY_REQUIRED,
      );
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'branch',
          action: 'SET_PAYMENT_POLICY',
          oldValues: { paymentPolicy: PaymentPolicy.PAY_AT_END },
          newValues: { paymentPolicy: PaymentPolicy.PREPAY_REQUIRED },
        }),
      );
      expect(result.paymentPolicy).toBe(PaymentPolicy.PREPAY_REQUIRED);
    });

    it('throws EntityNotFoundException when the branch is not owned by the business', async () => {
      branchesRepository.findById.mockResolvedValue(null);

      await expect(
        service.setPaymentPolicy(
          businessId,
          'branch-1',
          PaymentPolicy.PREPAY_REQUIRED,
        ),
      ).rejects.toThrow(EntityNotFoundException);
    });
  });
});
