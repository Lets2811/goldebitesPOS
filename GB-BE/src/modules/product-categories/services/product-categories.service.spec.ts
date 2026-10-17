import { CategoryOrderScope } from '../domain/product-category.types';
import { BusinessRuleException } from '../../../common/exceptions';
import {
  ConflictException,
  EntityNotFoundException,
} from '../../../common/exceptions';
import { ProductCategoryRow } from '../domain/product-category.interface';
import { ProductCategoriesService } from './product-categories.service';

describe('ProductCategoriesService', () => {
  let repository: {
    create: jest.Mock;
    findById: jest.Mock;
    findAll: jest.Mock;
    update: jest.Mock;
    setActive: jest.Mock;
    existsByName: jest.Mock;
    countOwned: jest.Mock;
    setOrder: jest.Mock;
  };
  let auditService: { record: jest.Mock };
  let service: ProductCategoriesService;

  const businessId = 'business-1';

  function makeRow(
    overrides: Partial<ProductCategoryRow> = {},
  ): ProductCategoryRow {
    return {
      id: 'cat-1',
      business_id: businessId,
      name: 'Burgers',
      description: null,
      display_order: 0,
      builder_display_order: 0,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
      ...overrides,
    };
  }

  beforeEach(() => {
    repository = {
      create: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
      update: jest.fn(),
      setActive: jest.fn(),
      existsByName: jest.fn(),
      countOwned: jest.fn(),
      setOrder: jest.fn(),
    };
    auditService = { record: jest.fn() };
    service = new ProductCategoriesService(repository, auditService as never);
  });

  describe('setOrder', () => {
    it('saves the order of the "Arma tu combo" sections', async () => {
      repository.countOwned.mockResolvedValue(3);

      await service.setOrder(businessId, CategoryOrderScope.BUILDER, ['c', 'a', 'b'], 'user-1');

      expect(repository.setOrder).toHaveBeenCalledWith(businessId, CategoryOrderScope.BUILDER, ['c', 'a', 'b']);
    });

    it('rejects a category of another business (or unknown)', async () => {
      repository.countOwned.mockResolvedValue(1);

      await expect(service.setOrder(businessId, CategoryOrderScope.MENU, ['a', 'foreign'])).rejects.toThrow(
        EntityNotFoundException,
      );
      expect(repository.setOrder).not.toHaveBeenCalled();
    });

    it('rejects a category listed twice', async () => {
      await expect(service.setOrder(businessId, CategoryOrderScope.MENU, ['a', 'a'])).rejects.toThrow(
        BusinessRuleException,
      );
      expect(repository.setOrder).not.toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('creates a category when the name is free', async () => {
      repository.existsByName.mockResolvedValue(false);
      repository.create.mockResolvedValue(makeRow());

      const category = await service.create({ businessId, name: 'Burgers' });

      expect(category.name).toBe('Burgers');
    });

    it('rejects a duplicate category name', async () => {
      repository.existsByName.mockResolvedValue(true);

      await expect(
        service.create({ businessId, name: 'Burgers' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findOne', () => {
    it('throws EntityNotFoundException when not owned by the business', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.findOne(businessId, 'cat-1')).rejects.toThrow(
        EntityNotFoundException,
      );
    });
  });

  describe('update', () => {
    it('rejects renaming to a name already used by another category', async () => {
      repository.findById.mockResolvedValue(makeRow());
      repository.existsByName.mockResolvedValue(true);

      await expect(
        service.update(businessId, 'cat-1', { name: 'Taken' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('setActive', () => {
    it('records an audit entry with the ACTIVATE/DEACTIVATE action', async () => {
      repository.findById.mockResolvedValue(makeRow());
      repository.setActive.mockResolvedValue(makeRow({ is_active: false }));

      const result = await service.setActive(
        businessId,
        'cat-1',
        false,
        'actor-1',
      );

      expect(result.isActive).toBe(false);
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'DEACTIVATE' }),
      );
    });
  });
});
