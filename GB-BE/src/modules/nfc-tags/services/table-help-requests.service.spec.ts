import { EntityNotFoundException } from '../../../common/exceptions';
import { TableHelpRequestRow } from '../domain/table-help-request.interface';
import { TableHelpRequestsService } from './table-help-requests.service';

describe('TableHelpRequestsService', () => {
  let helpRequestsRepository: {
    openForTable: jest.Mock;
    findPending: jest.Mock;
    markAttended: jest.Mock;
  };
  let nfcTagsService: { resolvePublic: jest.Mock };
  let service: TableHelpRequestsService;

  const businessId = 'business-1';
  const branchId = 'branch-1';

  function makeRow(
    overrides: Partial<TableHelpRequestRow> = {},
  ): TableHelpRequestRow {
    return {
      id: 'request-1',
      business_id: businessId,
      branch_id: branchId,
      table_number: '5',
      created_at: new Date('2026-10-09T15:00:00Z'),
      attended_at: null,
      ...overrides,
    };
  }

  beforeEach(() => {
    helpRequestsRepository = {
      openForTable: jest.fn().mockResolvedValue(makeRow()),
      findPending: jest.fn().mockResolvedValue([makeRow()]),
      markAttended: jest
        .fn()
        .mockResolvedValue(makeRow({ attended_at: new Date() })),
    };
    nfcTagsService = {
      resolvePublic: jest.fn().mockResolvedValue({
        businessId,
        branchId,
        businessName: 'Golden Bites',
        tableNumber: '5',
        selfServiceEnabled: true,
        tableName: null,
      }),
    };
    service = new TableHelpRequestsService(
      helpRequestsRepository as never,
      nfcTagsService as never,
    );
  });

  describe('requestFromToken', () => {
    it('opens the request for the table the token resolves to, never one the client names', async () => {
      const result = await service.requestFromToken('raw-token');

      expect(nfcTagsService.resolvePublic).toHaveBeenCalledWith('raw-token');
      expect(helpRequestsRepository.openForTable).toHaveBeenCalledWith(
        businessId,
        branchId,
        '5',
      );
      expect(result).toEqual({ requestedAt: new Date('2026-10-09T15:00:00Z') });
    });

    it('still works for a table with self-service off', async () => {
      nfcTagsService.resolvePublic.mockResolvedValue({
        businessId,
        branchId,
        businessName: 'Golden Bites',
        tableNumber: '5',
        selfServiceEnabled: false,
        tableName: null,
      });

      await service.requestFromToken('raw-token');

      expect(helpRequestsRepository.openForTable).toHaveBeenCalled();
    });

    it('opens nothing when the token does not resolve', async () => {
      nfcTagsService.resolvePublic.mockRejectedValue(
        new EntityNotFoundException('NfcTag', 'raw-token'),
      );

      await expect(service.requestFromToken('raw-token')).rejects.toThrow(
        EntityNotFoundException,
      );
      expect(helpRequestsRepository.openForTable).not.toHaveBeenCalled();
    });
  });

  it('findPending() scopes to the business and the optional branch', async () => {
    const result = await service.findPending(businessId, branchId);

    expect(helpRequestsRepository.findPending).toHaveBeenCalledWith(
      businessId,
      branchId,
    );
    expect(result).toEqual([
      expect.objectContaining({
        id: 'request-1',
        tableNumber: '5',
        branchId,
        attendedAt: null,
      }),
    ]);
  });

  describe('attend', () => {
    it('marks the request attended by the user', async () => {
      const result = await service.attend(businessId, 'request-1', 'user-1');

      expect(helpRequestsRepository.markAttended).toHaveBeenCalledWith(
        'request-1',
        businessId,
        'user-1',
      );
      expect(result.attendedAt).toBeInstanceOf(Date);
    });

    it('throws when there is nothing pending to attend (unknown, another business, or already attended)', async () => {
      helpRequestsRepository.markAttended.mockResolvedValue(null);

      await expect(
        service.attend(businessId, 'request-1', 'user-1'),
      ).rejects.toThrow(EntityNotFoundException);
    });
  });
});
