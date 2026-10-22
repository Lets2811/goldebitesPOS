import { SettingsController } from './settings.controller';
import { SettingsService } from '../services/settings.service';

describe('SettingsController', () => {
  let service: jest.Mocked<Pick<SettingsService, 'get' | 'update'>>;
  let controller: SettingsController;

  beforeEach(() => {
    service = { get: jest.fn(), update: jest.fn() };
    controller = new SettingsController(service as unknown as SettingsService);
  });

  it('get() scopes to the current business', async () => {
    service.get.mockResolvedValue({
      taxRate: 0.19,
      discountsAtCheckout: true,
      menuTopSellers: true,
    });
    await controller.get('business-1');
    expect(service.get).toHaveBeenCalledWith('business-1');
  });

  it('update() delegates with the actor', async () => {
    service.update.mockResolvedValue({
      taxRate: 0.19,
      discountsAtCheckout: true,
      menuTopSellers: true,
    });
    await controller.update('business-1', 'actor-1', { taxRate: 0.19 });
    expect(service.update).toHaveBeenCalledWith(
      'business-1',
      { taxRate: 0.19 },
      'actor-1',
    );
  });
});
