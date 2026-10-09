import { ConflictException, EntityNotFoundException } from '../../../common/exceptions';
import { NfcTagRow } from '../domain/nfc-tag.interface';
import { NfcTagsService } from './nfc-tags.service';

describe('NfcTagsService', () => {
  let nfcTagsRepository: {
    create: jest.Mock;
    findById: jest.Mock;
    findAllByBranch: jest.Mock;
    existsForBranchTable: jest.Mock;
    update: jest.Mock;
    setActive: jest.Mock;
    setSelfService: jest.Mock;
    updateToken: jest.Mock;
    findActiveByToken: jest.Mock;
  };
  let branchesService: { findOne: jest.Mock };
  let auditService: { record: jest.Mock };
  let tableNamesService: { findName: jest.Mock };
  let service: NfcTagsService;

  const businessId = 'business-1';
  const branchId = 'branch-1';
  const actorUserId = 'user-1';

  function makeRow(overrides: Partial<NfcTagRow> = {}): NfcTagRow {
    return {
      id: 'tag-1',
      business_id: businessId,
      branch_id: branchId,
      table_number: '1',
      name: 'Mesa 1',
      token: 'raw-token-value',
      is_active: true,
      self_service_enabled: true,
      created_at: new Date(),
      updated_at: new Date(),
      ...overrides,
    };
  }

  beforeEach(() => {
    nfcTagsRepository = {
      create: jest.fn().mockResolvedValue(makeRow()),
      findById: jest.fn().mockResolvedValue(makeRow()),
      findAllByBranch: jest.fn().mockResolvedValue([]),
      existsForBranchTable: jest.fn().mockResolvedValue(false),
      update: jest.fn().mockResolvedValue(makeRow()),
      setActive: jest.fn().mockResolvedValue(makeRow({ is_active: false })),
      setSelfService: jest.fn().mockResolvedValue(makeRow({ self_service_enabled: false })),
      updateToken: jest.fn().mockResolvedValue(makeRow({ token: 'new-token' })),
      findActiveByToken: jest.fn(),
    };
    branchesService = { findOne: jest.fn().mockResolvedValue({ id: branchId }) };
    auditService = { record: jest.fn() };
    tableNamesService = { findName: jest.fn().mockResolvedValue(null) };
    service = new NfcTagsService(
      nfcTagsRepository as never,
      branchesService as never,
      auditService as never,
      tableNamesService as never,
    );
  });

  describe('register', () => {
    it('validates the branch, generates a token, and creates the row', async () => {
      const result = await service.register({ businessId, branchId, tableNumber: '1', name: 'Mesa 1', actorUserId });

      expect(branchesService.findOne).toHaveBeenCalledWith(businessId, branchId);
      expect(nfcTagsRepository.existsForBranchTable).toHaveBeenCalledWith(branchId, '1', undefined);
      expect(nfcTagsRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ branchId, tableNumber: '1', name: 'Mesa 1', token: expect.any(String) }),
      );
      // A real, non-trivial token — not empty, not a fixed placeholder.
      const createdToken = nfcTagsRepository.create.mock.calls[0][0].token;
      expect(createdToken.length).toBeGreaterThan(20);
      expect(result.id).toBe('tag-1');
      expect(auditService.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'CREATE', entityType: 'nfc_tag' }));
    });

    it('rejects when the branch already has a gallo for that table', async () => {
      nfcTagsRepository.existsForBranchTable.mockResolvedValue(true);

      await expect(
        service.register({ businessId, branchId, tableNumber: '1', name: 'Mesa 1', actorUserId }),
      ).rejects.toThrow(ConflictException);
      expect(nfcTagsRepository.create).not.toHaveBeenCalled();
    });

    it('propagates EntityNotFoundException when the branch does not belong to the business', async () => {
      branchesService.findOne.mockRejectedValue(new EntityNotFoundException('Branch', branchId));

      await expect(
        service.register({ businessId, branchId, tableNumber: '1', name: 'Mesa 1', actorUserId }),
      ).rejects.toThrow(EntityNotFoundException);
      expect(nfcTagsRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('update (reassignment)', () => {
    it('validates the destination branch and re-checks table availability when reassigning', async () => {
      await service.update(businessId, 'tag-1', { branchId: 'branch-2', tableNumber: '5' }, actorUserId);

      expect(branchesService.findOne).toHaveBeenCalledWith(businessId, 'branch-2');
      expect(nfcTagsRepository.existsForBranchTable).toHaveBeenCalledWith('branch-2', '5', 'tag-1');
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'UPDATE',
          oldValues: expect.objectContaining({ branchId, tableNumber: '1' }),
          newValues: expect.objectContaining({ branchId: 'branch-2', tableNumber: '5' }),
        }),
      );
    });

    it('rejects reassigning onto a table that already has a different gallo', async () => {
      nfcTagsRepository.existsForBranchTable.mockResolvedValue(true);

      await expect(
        service.update(businessId, 'tag-1', { tableNumber: '9' }, actorUserId),
      ).rejects.toThrow(ConflictException);
      expect(nfcTagsRepository.update).not.toHaveBeenCalled();
    });

    it('renaming only, without touching branch/table, does not re-check table availability', async () => {
      await service.update(businessId, 'tag-1', { name: 'Mesa 1 - Terraza' }, actorUserId);
      expect(nfcTagsRepository.existsForBranchTable).not.toHaveBeenCalled();
    });
  });

  describe('setActive', () => {
    it('activates/deactivates and audits accordingly', async () => {
      await service.setActive(businessId, 'tag-1', false, actorUserId);
      expect(nfcTagsRepository.setActive).toHaveBeenCalledWith('tag-1', businessId, false);
      expect(auditService.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'DEACTIVATE' }));
    });
  });

  describe('setSelfService', () => {
    it('turns self-service off for the table and audits the change', async () => {
      const result = await service.setSelfService(businessId, 'tag-1', false, actorUserId);

      expect(nfcTagsRepository.setSelfService).toHaveBeenCalledWith('tag-1', businessId, false);
      expect(result.selfServiceEnabled).toBe(false);
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          entityId: 'tag-1',
          oldValues: { selfServiceEnabled: true },
          newValues: { selfServiceEnabled: false },
        }),
      );
    });

    it('rejects a gallo that belongs to another business', async () => {
      nfcTagsRepository.findById.mockResolvedValue(null);

      await expect(service.setSelfService(businessId, 'tag-1', false, actorUserId)).rejects.toThrow(
        EntityNotFoundException,
      );
      expect(nfcTagsRepository.setSelfService).not.toHaveBeenCalled();
    });
  });

  describe('regenerateToken', () => {
    it('generates a new token, persists it, and audits without logging the value', async () => {
      const result = await service.regenerateToken(businessId, 'tag-1', actorUserId);

      expect(nfcTagsRepository.updateToken).toHaveBeenCalledWith('tag-1', businessId, expect.any(String));
      const newToken = nfcTagsRepository.updateToken.mock.calls[0][2];
      expect(newToken).not.toBe('raw-token-value');
      expect(result.token).toBe('new-token');
      const auditCall = auditService.record.mock.calls.find((call) => call[0].action === 'REGENERATE_TOKEN');
      expect(auditCall).toBeDefined();
      expect(JSON.stringify(auditCall[0])).not.toContain(newToken);
    });
  });

  describe('resolvePublic', () => {
    it('returns the resolved context for an active gallo with an active branch and business, with no custom table name', async () => {
      nfcTagsRepository.findActiveByToken.mockResolvedValue({
        businessId,
        branchId,
        businessName: 'Golden Bites',
        tableNumber: '1',
      });

      const result = await service.resolvePublic('some-token');
      expect(result).toEqual({
        businessId,
        branchId,
        businessName: 'Golden Bites',
        tableNumber: '1',
        tableName: null,
      });
    });

    it('includes the table\'s custom name when one is set', async () => {
      nfcTagsRepository.findActiveByToken.mockResolvedValue({
        businessId,
        branchId,
        businessName: 'Golden Bites',
        tableNumber: '1',
      });
      tableNamesService.findName.mockResolvedValue('Terraza');

      const result = await service.resolvePublic('some-token');

      expect(tableNamesService.findName).toHaveBeenCalledWith(businessId, branchId, '1');
      expect(result.tableName).toBe('Terraza');
    });

    it('throws a generic EntityNotFoundException when the token does not resolve to anything active', async () => {
      // findActiveByToken already collapses "doesn't exist" / "gallo inactive" /
      // "branch inactive" / "business inactive" into the same null — this just
      // confirms the service surfaces that uniformly too.
      nfcTagsRepository.findActiveByToken.mockResolvedValue(null);

      await expect(service.resolvePublic('bogus-or-disabled')).rejects.toThrow(EntityNotFoundException);
    });
  });
});
