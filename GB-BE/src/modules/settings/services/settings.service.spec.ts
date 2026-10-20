import { SettingsService } from './settings.service';

describe('SettingsService', () => {
  let businessesService: {
    findById: jest.Mock;
    updateTaxRate: jest.Mock;
    updateDiscountsAtCheckout: jest.Mock;
  };
  let service: SettingsService;

  beforeEach(() => {
    businessesService = {
      findById: jest.fn().mockResolvedValue({
        id: 'business-1',
        taxRate: 0.19,
        discountsAtCheckout: true,
      }),
      updateTaxRate: jest.fn().mockResolvedValue(undefined),
      updateDiscountsAtCheckout: jest.fn().mockResolvedValue(undefined),
    };
    service = new SettingsService(businessesService as never);
  });

  it('get() returns the tax rate and whether the checkout offers discounts', async () => {
    const settings = await service.get('business-1');
    expect(settings).toEqual({ taxRate: 0.19, discountsAtCheckout: true });
  });

  it('update() changes the tax rate only when it comes in', async () => {
    await service.update('business-1', { taxRate: 0.1 }, 'actor-1');

    expect(businessesService.updateTaxRate).toHaveBeenCalledWith(
      'business-1',
      0.1,
      'actor-1',
    );
    expect(businessesService.updateDiscountsAtCheckout).not.toHaveBeenCalled();
  });

  it('update() turns the checkout discounts off without touching the tax rate', async () => {
    businessesService.findById.mockResolvedValue({
      id: 'business-1',
      taxRate: 0.19,
      discountsAtCheckout: false,
    });

    const settings = await service.update(
      'business-1',
      { discountsAtCheckout: false },
      'actor-1',
    );

    expect(businessesService.updateDiscountsAtCheckout).toHaveBeenCalledWith(
      'business-1',
      false,
      'actor-1',
    );
    expect(businessesService.updateTaxRate).not.toHaveBeenCalled();
    expect(settings).toEqual({ taxRate: 0.19, discountsAtCheckout: false });
  });
});
