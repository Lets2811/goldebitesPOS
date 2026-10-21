import { EntityNotFoundException } from '../../../common/exceptions';
import { BusinessRow } from '../domain/business.interface';
import { BusinessesService } from './businesses.service';

describe('BusinessesService', () => {
  let businessesRepository: {
    create: jest.Mock;
    findAll: jest.Mock;
    findById: jest.Mock;
    update: jest.Mock;
    setActive: jest.Mock;
    updateTaxRate: jest.Mock;
    updateDiscountsAtCheckout: jest.Mock;
    updateComboBuilder: jest.Mock;
    getComboBuilderTemplate: jest.Mock;
    updateMenuTopSellers: jest.Mock;
    setComboBuilderTemplate: jest.Mock;
    updateLoyaltyConfig: jest.Mock;
    setLogo: jest.Mock;
    getLogo: jest.Mock;
    clearLogo: jest.Mock;
  };
  let rolesService: { provisionSystemRoles: jest.Mock };
  let transactionService: { execute: jest.Mock };
  let auditService: { record: jest.Mock };
  let service: BusinessesService;

  function makeBusinessRow(overrides: Partial<BusinessRow> = {}): BusinessRow {
    return {
      id: 'business-1',
      name: 'Golden Bites',
      legal_name: null,
      tax_id: null,
      email: null,
      phone: null,
      currency: 'COP',
      timezone: 'America/Bogota',
      tax_rate: '0.0000',
      discounts_at_checkout: true,
      menu_top_sellers: true,
      combo_builder_name: null,
      combo_builder_description: null,
      has_combo_builder_template: false,
      loyalty_points_per_thousand: '1.00',
      loyalty_birthday_bonus_enabled: false,
      loyalty_birthday_bonus_points: 0,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
      ...overrides,
    };
  }

  beforeEach(() => {
    businessesRepository = {
      create: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      setActive: jest.fn(),
      updateTaxRate: jest.fn(),
      updateDiscountsAtCheckout: jest.fn(),
      updateMenuTopSellers: jest.fn(),
      updateComboBuilder: jest.fn(),
      getComboBuilderTemplate: jest.fn(),
      setComboBuilderTemplate: jest.fn(),
      updateLoyaltyConfig: jest.fn(),
      setLogo: jest.fn(),
      getLogo: jest.fn(),
      clearLogo: jest.fn(),
    };
    rolesService = {
      provisionSystemRoles: jest.fn().mockResolvedValue(new Map()),
    };
    transactionService = {
      execute: jest.fn((work: (client: unknown) => Promise<unknown>) =>
        work({}),
      ),
    };
    auditService = { record: jest.fn() };

    service = new BusinessesService(
      businessesRepository,
      rolesService as never,
      transactionService as never,
      auditService as never,
    );
  });

  describe('create', () => {
    it('creates the business and provisions its role catalog in the same transaction', async () => {
      businessesRepository.create.mockResolvedValue(makeBusinessRow());

      const business = await service.create(
        { name: 'Golden Bites' },
        'actor-1',
      );

      expect(business.name).toBe('Golden Bites');
      expect(transactionService.execute).toHaveBeenCalled();
      expect(rolesService.provisionSystemRoles).toHaveBeenCalledWith(
        'business-1',
        {},
      );
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CREATE', entityType: 'business' }),
        {},
      );
    });
  });

  describe('findById', () => {
    it('throws EntityNotFoundException when the business does not exist', async () => {
      businessesRepository.findById.mockResolvedValue(null);

      await expect(service.findById('missing')).rejects.toThrow(
        EntityNotFoundException,
      );
    });
  });

  describe('setActive', () => {
    it('activates/deactivates and audits the change', async () => {
      businessesRepository.findById.mockResolvedValue(makeBusinessRow());
      businessesRepository.setActive.mockResolvedValue(
        makeBusinessRow({ is_active: false }),
      );

      const business = await service.setActive('business-1', false, 'actor-1');

      expect(business.isActive).toBe(false);
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'DEACTIVATE' }),
      );
    });
  });
});
