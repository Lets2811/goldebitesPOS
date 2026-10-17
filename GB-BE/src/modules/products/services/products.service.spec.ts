import { ProductMenuAvailability } from '../domain/product.types';
import {
  ConflictException,
  EntityNotFoundException,
} from '../../../common/exceptions';
import { ProductRow } from '../domain/product.interface';
import { ProductsService } from './products.service';

describe('ProductsService', () => {
  let optionGroupsService: {
    getProductGroups: jest.Mock;
    assertProductGroupsValid: jest.Mock;
    setProductGroups: jest.Mock;
  };
  let repository: {
    create: jest.Mock;
    findById: jest.Mock;
    findAll: jest.Mock;
    findAvailableForSale: jest.Mock;
    update: jest.Mock;
    setActive: jest.Mock;
    setVisible: jest.Mock;
    setCurrentCost: jest.Mock;
    softDelete: jest.Mock;
    existsBySku: jest.Mock;
    setImage: jest.Mock;
    clearImage: jest.Mock;
    findImageFile: jest.Mock;
  };
  let categoriesService: { findOne: jest.Mock };
  let auditService: { record: jest.Mock };
  let service: ProductsService;

  const businessId = 'business-1';

  function makeRow(overrides: Partial<ProductRow> = {}): ProductRow {
    return {
      id: 'product-1',
      business_id: businessId,
      category_id: null,
      name: 'Classic Burger',
      description: null,
      sku: null,
      sale_price: '25000.00',
      current_cost: '0.00',
      image_url: null,
      image_path: null,
      image_mime_type: null,
      image_updated_at: null,
      is_active: true,
      is_visible: true,
      track_inventory: true,
      menu_availability: ProductMenuAvailability.MENU,
      created_at: new Date(),
      updated_at: new Date(),
      deleted_at: null,
      ...overrides,
    };
  }

  beforeEach(() => {
    repository = {
      create: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
      findAvailableForSale: jest.fn(),
      update: jest.fn(),
      setActive: jest.fn(),
      setVisible: jest.fn(),
      setCurrentCost: jest.fn(),
      softDelete: jest.fn(),
      existsBySku: jest.fn(),
      setImage: jest.fn(),
      clearImage: jest.fn(),
      findImageFile: jest.fn(),
    };
    categoriesService = { findOne: jest.fn() };
    optionGroupsService = {
      getProductGroups: jest.fn().mockResolvedValue(new Map()),
      assertProductGroupsValid: jest.fn(),
      setProductGroups: jest.fn(),
    };
    auditService = { record: jest.fn() };
    service = new ProductsService(
      repository,
      categoriesService as never,
      auditService as never,
      optionGroupsService as never,
    );
  });

  describe('create', () => {
    it('validates the category belongs to the business when provided', async () => {
      categoriesService.findOne.mockResolvedValue({ id: 'cat-1' });
      repository.create.mockResolvedValue(makeRow({ category_id: 'cat-1' }));

      await service.create({
        businessId,
        name: 'Classic Burger',
        categoryId: 'cat-1',
      });

      expect(categoriesService.findOne).toHaveBeenCalledWith(
        businessId,
        'cat-1',
      );
    });

    it('rejects a duplicate SKU', async () => {
      repository.existsBySku.mockResolvedValue(true);

      await expect(
        service.create({ businessId, name: 'Classic Burger', sku: 'BRG-1' }),
      ).rejects.toThrow(ConflictException);
    });

    it('parses sale_price/current_cost NUMERIC strings into numbers', async () => {
      repository.create.mockResolvedValue(makeRow({ sale_price: '25000.50' }));

      const product = await service.create({
        businessId,
        name: 'Classic Burger',
      });

      expect(product.salePrice).toBe(25000.5);
      expect(typeof product.salePrice).toBe('number');
    });

    it('validates and saves the option groups the product offers, and returns them', async () => {
      const groups = [{ groupId: 'g-salsas', maxChoices: 2 }];
      repository.create.mockResolvedValue(makeRow());
      optionGroupsService.getProductGroups.mockResolvedValue(
        new Map([['product-1', groups]]),
      );

      const product = await service.create({
        businessId,
        name: 'Classic Burger',
        optionGroups: groups,
      });

      expect(optionGroupsService.assertProductGroupsValid).toHaveBeenCalledWith(
        businessId,
        groups,
      );
      expect(optionGroupsService.setProductGroups).toHaveBeenCalledWith(
        'product-1',
        groups,
      );
      expect(product.optionGroups).toEqual(groups);
    });

    it('does not save anything when a group is not valid', async () => {
      optionGroupsService.assertProductGroupsValid.mockRejectedValue(
        new ConflictException('nope', 'PRODUCT_OPTION_GROUP_UNKNOWN'),
      );

      await expect(
        service.create({
          businessId,
          name: 'Classic Burger',
          optionGroups: [{ groupId: 'other', maxChoices: 1 }],
        }),
      ).rejects.toThrow(ConflictException);
      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  describe('photo', () => {
    it('serves an uploaded photo from the public, versioned image URL', async () => {
      const uploadedAt = new Date('2026-10-16T12:00:00Z');
      repository.findById.mockResolvedValue(makeRow({ image_path: null }));
      repository.setImage.mockResolvedValue(
        makeRow({
          image_url: 'https://old.example.com/a.jpg',
          image_path: '/uploads/product-images/x.webp',
          image_mime_type: 'image/webp',
          image_updated_at: uploadedAt,
        }),
      );

      const product = await service.setImage(
        businessId,
        'product-1',
        '/uploads/product-images/x.webp',
        'image/webp',
      );

      expect(product.imageUrl).toBe(
        `/api/v1/public/product-images/product-1?v=${uploadedAt.getTime()}`,
      );
    });

    it('keeps a linked photo when nothing was uploaded', async () => {
      repository.findById.mockResolvedValue(
        makeRow({ image_url: 'https://cdn.example.com/a.jpg' }),
      );

      const product = await service.findOne(businessId, 'product-1');

      expect(product.imageUrl).toBe('https://cdn.example.com/a.jpg');
    });

    it("doesn't save a photo for a product of another business", async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.setImage(businessId, 'other', '/tmp/x.webp', 'image/webp'),
      ).rejects.toThrow(EntityNotFoundException);
      expect(repository.setImage).not.toHaveBeenCalled();
    });
  });

  describe('getMargin', () => {
    it('computes margin amount and percent, rounded to 2 decimals', async () => {
      repository.findById.mockResolvedValue(
        makeRow({ sale_price: '25000.50', current_cost: '3.58' }),
      );

      const margin = await service.getMargin(businessId, 'product-1');

      expect(margin.salePrice).toBe(25000.5);
      expect(margin.currentCost).toBe(3.58);
      expect(margin.marginAmount).toBe(24996.92);
      expect(margin.marginPercent).toBeCloseTo(99.99, 1);
    });

    it('returns 0% margin when sale price is 0 (avoids division by zero)', async () => {
      repository.findById.mockResolvedValue(
        makeRow({ sale_price: '0', current_cost: '0' }),
      );

      const margin = await service.getMargin(businessId, 'product-1');

      expect(margin.marginPercent).toBe(0);
    });
  });

  describe('syncCostFromRecipe', () => {
    it('rounds the cost to 2 decimals before persisting', async () => {
      await service.syncCostFromRecipe(businessId, 'product-1', 3.5789);

      expect(repository.setCurrentCost).toHaveBeenCalledWith(
        'product-1',
        businessId,
        3.58,
        undefined,
      );
    });
  });

  describe('softDelete', () => {
    it('throws EntityNotFoundException when nothing was deleted', async () => {
      repository.softDelete.mockResolvedValue(null);

      await expect(service.softDelete(businessId, 'product-1')).rejects.toThrow(
        EntityNotFoundException,
      );
    });
  });

  describe('findAvailableForSale', () => {
    it('maps every row to the public Product shape', async () => {
      repository.findAvailableForSale.mockResolvedValue([makeRow()]);

      const products = await service.findAvailableForSale(businessId);

      expect(products).toHaveLength(1);
      expect(products[0].id).toBe('product-1');
    });
  });

  describe('setVisible', () => {
    it('hides a product independently of isActive, recording a HIDE audit action', async () => {
      repository.findById.mockResolvedValue(makeRow());
      repository.setVisible.mockResolvedValue(makeRow({ is_visible: false }));

      const product = await service.setVisible(
        businessId,
        'product-1',
        false,
        'user-1',
      );

      expect(repository.setVisible).toHaveBeenCalledWith(
        'product-1',
        businessId,
        false,
      );
      expect(product.isVisible).toBe(false);
      expect(product.isActive).toBe(true);
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ entityType: 'product', action: 'HIDE' }),
      );
    });

    it('records a SHOW audit action when making a product visible again', async () => {
      repository.findById.mockResolvedValue(makeRow({ is_visible: false }));
      repository.setVisible.mockResolvedValue(makeRow({ is_visible: true }));

      await service.setVisible(businessId, 'product-1', true, 'user-1');

      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'SHOW' }),
      );
    });

    it('throws EntityNotFoundException when nothing was updated', async () => {
      repository.findById.mockResolvedValue(makeRow());
      repository.setVisible.mockResolvedValue(null);

      await expect(
        service.setVisible(businessId, 'product-1', false),
      ).rejects.toThrow(EntityNotFoundException);
    });
  });
});
