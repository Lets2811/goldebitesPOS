import { NfcTagsController } from './nfc-tags.controller';
import { NfcTagsService } from '../services/nfc-tags.service';

describe('NfcTagsController', () => {
  let service: jest.Mocked<
    Pick<NfcTagsService, 'register' | 'findAllByBranch' | 'update' | 'setActive' | 'setSelfService' | 'regenerateToken'>
  >;
  let controller: NfcTagsController;

  beforeEach(() => {
    service = {
      register: jest.fn(),
      findAllByBranch: jest.fn(),
      update: jest.fn(),
      setActive: jest.fn(),
      setSelfService: jest.fn(),
      regenerateToken: jest.fn(),
    };
    controller = new NfcTagsController(service as unknown as NfcTagsService);
  });

  it('register() scopes to the current business and forwards the actor', async () => {
    service.register.mockResolvedValue({} as never);
    await controller.register('business-1', 'user-1', { branchId: 'branch-1', tableNumber: '1', name: 'Mesa 1' });
    expect(service.register).toHaveBeenCalledWith({
      businessId: 'business-1',
      branchId: 'branch-1',
      tableNumber: '1',
      name: 'Mesa 1',
      actorUserId: 'user-1',
    });
  });

  it('findAllByBranch() scopes to the current business and forwards the query', async () => {
    service.findAllByBranch.mockResolvedValue([]);
    await controller.findAllByBranch('business-1', { branchId: 'branch-1' });
    expect(service.findAllByBranch).toHaveBeenCalledWith('business-1', 'branch-1');
  });

  it('update() forwards id, dto, and actor', async () => {
    service.update.mockResolvedValue({} as never);
    await controller.update('business-1', 'user-1', 'tag-1', { name: 'Nuevo nombre' });
    expect(service.update).toHaveBeenCalledWith('business-1', 'tag-1', { name: 'Nuevo nombre' }, 'user-1');
  });

  it('setStatus() forwards isActive', async () => {
    service.setActive.mockResolvedValue({} as never);
    await controller.setStatus('business-1', 'user-1', 'tag-1', { isActive: false });
    expect(service.setActive).toHaveBeenCalledWith('business-1', 'tag-1', false, 'user-1');
  });

  it('setSelfService() forwards the flag', async () => {
    service.setSelfService.mockResolvedValue({} as never);
    await controller.setSelfService('business-1', 'user-1', 'tag-1', { enabled: false });
    expect(service.setSelfService).toHaveBeenCalledWith('business-1', 'tag-1', false, 'user-1');
  });

  it('regenerateToken() forwards id and actor', async () => {
    service.regenerateToken.mockResolvedValue({} as never);
    await controller.regenerateToken('business-1', 'user-1', 'tag-1');
    expect(service.regenerateToken).toHaveBeenCalledWith('business-1', 'tag-1', 'user-1');
  });
});
