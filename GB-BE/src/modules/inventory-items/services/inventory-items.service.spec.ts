import {
  ConflictException,
  EntityNotFoundException,
} from '../../../common/exceptions';
import { InventoryItemRow } from '../domain/inventory-item.interface';
import { InventoryItemsService } from './inventory-items.service';

describe('InventoryItemsService', () => {
  let repository: {
    create: jest.Mock;
    findById: jest.Mock;
    findAll: jest.Mock;
    update: jest.Mock;
    setActive: jest.Mock;
    softDelete: jest.Mock;
    existsBySku: jest.Mock;
    queryAdvanced: jest.Mock;
    queryAggregate: jest.Mock;
  };
  let auditService: { record: jest.Mock };
  let service: InventoryItemsService;

  const businessId = 'business-1';

  function makeRow(
    overrides: Partial<InventoryItemRow> = {},
  ): InventoryItemRow {
    return {
      id: 'item-1',
      business_id: businessId,
      category_id: null,
      name: 'Flour',
      sku: null,
      unit: 'kg',
      minimum_stock: '5.000',
      current_cost: '2.50',
      serial_number: null,
      brand: null,
      model: null,
      branch_id: 'branch-1',
      is_active: true,
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
      update: jest.fn(),
      setActive: jest.fn(),
      softDelete: jest.fn(),
      existsBySku: jest.fn(),
      queryAdvanced: jest.fn(),
      queryAggregate: jest.fn(),
    };
    auditService = { record: jest.fn() };
    service = new InventoryItemsService(repository, auditService as never);
  });

  describe('create', () => {
    it('parses NUMERIC string columns into JS numbers', async () => {
      repository.create.mockResolvedValue(makeRow());

      const item = await service.create({
        businessId,
        branchId: 'branch-1',
        name: 'Flour',
        unit: 'kg',
      });

      expect(item.minimumStock).toBe(5);
      expect(item.currentCost).toBe(2.5);
      expect(typeof item.minimumStock).toBe('number');
    });

    it('rejects a duplicate SKU within the same business', async () => {
      repository.existsBySku.mockResolvedValue(true);

      await expect(
        service.create({
          businessId,
          branchId: 'branch-1',
          name: 'Flour',
          unit: 'kg',
          sku: 'FLR-1',
        }),
      ).rejects.toThrow(ConflictException);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('skips the SKU uniqueness check when no SKU is given', async () => {
      repository.create.mockResolvedValue(makeRow());

      await service.create({
        businessId,
        branchId: 'branch-1',
        name: 'Flour',
        unit: 'kg',
      });

      expect(repository.existsBySku).not.toHaveBeenCalled();
    });
  });

  describe('softDelete', () => {
    it('throws EntityNotFoundException when nothing was deleted', async () => {
      repository.softDelete.mockResolvedValue(null);

      await expect(service.softDelete(businessId, 'item-1')).rejects.toThrow(
        EntityNotFoundException,
      );
    });
  });

  describe('getOwnedOrFail', () => {
    it('returns the raw row for use by RecipesService', async () => {
      repository.findById.mockResolvedValue(makeRow());

      const row = await service.getOwnedOrFail(businessId, 'item-1');

      expect(row.id).toBe('item-1');
    });

    it('throws EntityNotFoundException when not found', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.getOwnedOrFail(businessId, 'missing'),
      ).rejects.toThrow(EntityNotFoundException);
    });
  });
});
