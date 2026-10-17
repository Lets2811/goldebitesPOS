import { PublicMenuController } from './public-menu.controller';
import { PublicMenuService } from '../services/public-menu.service';

describe('PublicMenuController', () => {
  let service: jest.Mocked<Pick<PublicMenuService, 'getMenu'>>;
  let controller: PublicMenuController;

  beforeEach(() => {
    service = { getMenu: jest.fn() };
    controller = new PublicMenuController(service as unknown as PublicMenuService);
  });

  it('getMenu() forwards the businessId path param', async () => {
    service.getMenu.mockResolvedValue({ businessName: 'Golden Bites', categories: [], builderCategories: [], optionGroups: [] });
    await controller.getMenu('business-1');
    expect(service.getMenu).toHaveBeenCalledWith('business-1');
  });
});
