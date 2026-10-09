import { PublicNfcController } from './public-nfc.controller';
import { NfcTagsService } from '../services/nfc-tags.service';
import { TableHelpRequestsService } from '../services/table-help-requests.service';

describe('PublicNfcController', () => {
  let service: jest.Mocked<Pick<NfcTagsService, 'resolvePublic'>>;
  let helpRequestsService: jest.Mocked<Pick<TableHelpRequestsService, 'requestFromToken'>>;
  let controller: PublicNfcController;

  beforeEach(() => {
    service = { resolvePublic: jest.fn() };
    helpRequestsService = { requestFromToken: jest.fn() };
    controller = new PublicNfcController(
      service as unknown as NfcTagsService,
      helpRequestsService as unknown as TableHelpRequestsService,
    );
  });

  it('resolve() forwards the token param', async () => {
    service.resolvePublic.mockResolvedValue({
      businessId: 'business-1',
      branchId: 'branch-1',
      businessName: 'Golden Bites',
      tableNumber: '1',
      selfServiceEnabled: true,
      tableName: null,
    });

    const result = await controller.resolve('some-token');

    expect(service.resolvePublic).toHaveBeenCalledWith('some-token');
    expect(result.tableNumber).toBe('1');
  });
  it('requestHelp() forwards the token param', async () => {
    const requestedAt = new Date();
    helpRequestsService.requestFromToken.mockResolvedValue({ requestedAt });

    const result = await controller.requestHelp('some-token');

    expect(helpRequestsService.requestFromToken).toHaveBeenCalledWith('some-token');
    expect(result.requestedAt).toBe(requestedAt);
  });
});
