import {
  BusinessRuleException,
  ConflictException,
  EntityNotFoundException,
} from '../../../common/exceptions';
import { ExpenseCategoryRow } from '../domain/expense-category.interface';
import { ExpenseCategoriesService } from './expense-categories.service';

describe('ExpenseCategoriesService', () => {
  let repository: {
    findAll: jest.Mock;
    findById: jest.Mock;
    findByCode: jest.Mock;
    existsByName: jest.Mock;
    insertDefaults: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    countExpenses: jest.Mock;
    delete: jest.Mock;
  };
  let auditService: { record: jest.Mock };
  let service: ExpenseCategoriesService;

  const businessId = 'business-1';

  function makeRow(
    overrides: Partial<ExpenseCategoryRow> = {},
  ): ExpenseCategoryRow {
    return {
      id: 'category-1',
      business_id: businessId,
      code: 'OPERATING',
      name: 'Gastos operativos',
      is_cost_of_sales: false,
      is_active: true,
      sort_order: 2,
      created_at: new Date(),
      updated_at: new Date(),
      ...overrides,
    };
  }

  const cogs = makeRow({
    id: 'category-0',
    code: 'COGS',
    name: 'Costo de ventas',
    is_cost_of_sales: true,
    sort_order: 1,
  });

  beforeEach(() => {
    repository = {
      findAll: jest.fn().mockResolvedValue([cogs, makeRow()]),
      findById: jest.fn().mockResolvedValue(makeRow()),
      findByCode: jest.fn(),
      existsByName: jest.fn().mockResolvedValue(false),
      insertDefaults: jest.fn(),
      create: jest
        .fn()
        .mockImplementation(
          (data: { code: string; name: string; isCostOfSales: boolean }) =>
            Promise.resolve(
              makeRow({
                id: 'category-new',
                code: data.code,
                name: data.name,
                is_cost_of_sales: data.isCostOfSales,
              }),
            ),
        ),
      update: jest
        .fn()
        .mockImplementation(
          (
            _id: string,
            _business: string,
            data: { name?: string; isActive?: boolean },
          ) =>
            Promise.resolve(
              makeRow({
                name: data.name ?? 'Gastos operativos',
                is_active: data.isActive ?? true,
              }),
            ),
        ),
      countExpenses: jest.fn().mockResolvedValue(0),
      delete: jest.fn().mockResolvedValue(true),
    };
    auditService = { record: jest.fn() };
    service = new ExpenseCategoriesService(
      repository as never,
      auditService as never,
    );
  });

  describe('findAll', () => {
    it("lists the business's categories", async () => {
      const categories = await service.findAll(businessId);

      expect(categories.map((category) => category.code)).toEqual([
        'COGS',
        'OPERATING',
      ]);
      expect(categories[0]).toMatchObject({
        name: 'Costo de ventas',
        isCostOfSales: true,
        isActive: true,
      });
      expect(repository.insertDefaults).not.toHaveBeenCalled();
    });

    it('gives a business with none the starting ones', async () => {
      repository.findAll
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([cogs]);

      const categories = await service.findAll(businessId);

      expect(repository.insertDefaults).toHaveBeenCalledWith(businessId);
      expect(categories).toHaveLength(1);
    });
  });

  describe('create', () => {
    it('adds a category with a code of its own, trimmed name, and audits it', async () => {
      const created = await service.create(
        { businessId, name: '  Arriendo  ' },
        'user-1',
      );

      const [data] = repository.create.mock.calls[0] as [
        { code: string; name: string; isCostOfSales: boolean },
      ];
      expect(data.name).toBe('Arriendo');
      expect(data.isCostOfSales).toBe(false);
      expect(data.code).toMatch(/^C[0-9A-F]{12}$/);
      expect(created.name).toBe('Arriendo');
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'expense_category',
          action: 'CREATE',
          userId: 'user-1',
        }),
      );
    });

    it('refuses a name the business already uses', async () => {
      repository.existsByName.mockResolvedValue(true);

      await expect(
        service.create({ businessId, name: 'Nómina' }),
      ).rejects.toThrow(ConflictException);
      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('renames without touching the code expenses point at', async () => {
      const updated = await service.update(businessId, 'category-1', {
        name: 'Operación',
      });

      expect(repository.update).toHaveBeenCalledWith('category-1', businessId, {
        name: 'Operación',
      });
      expect(updated.code).toBe('OPERATING');
      expect(repository.existsByName).toHaveBeenCalledWith(
        businessId,
        'Operación',
        'category-1',
      );
    });

    it("refuses another business's category", async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.update(businessId, 'category-9', { name: 'X1' }),
      ).rejects.toThrow(EntityNotFoundException);
    });

    it('deactivates a category while another stays active', async () => {
      const updated = await service.update(businessId, 'category-1', {
        isActive: false,
      });

      expect(updated.isActive).toBe(false);
    });

    it('refuses to deactivate the last active one', async () => {
      repository.findAll.mockResolvedValue([
        makeRow(),
        { ...cogs, is_active: false },
      ]);

      await expect(
        service.update(businessId, 'category-1', { isActive: false }),
      ).rejects.toMatchObject({
        code: 'LAST_ACTIVE_EXPENSE_CATEGORY',
      });
      expect(repository.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('deletes a category nobody used', async () => {
      await service.remove(businessId, 'category-1', 'user-1');

      expect(repository.countExpenses).toHaveBeenCalledWith(
        businessId,
        'OPERATING',
      );
      expect(repository.delete).toHaveBeenCalledWith('category-1', businessId);
    });

    it('keeps one that has expenses, so they do not lose their name', async () => {
      repository.countExpenses.mockResolvedValue(12);

      await expect(
        service.remove(businessId, 'category-1'),
      ).rejects.toMatchObject({ code: 'EXPENSE_CATEGORY_IN_USE' });
      expect(repository.delete).not.toHaveBeenCalled();
    });

    it('refuses to delete the last active one', async () => {
      repository.findAll.mockResolvedValue([makeRow()]);

      await expect(service.remove(businessId, 'category-1')).rejects.toThrow(
        BusinessRuleException,
      );
      expect(repository.delete).not.toHaveBeenCalled();
    });
  });

  describe('assertUsable', () => {
    it('accepts an active category of the business', async () => {
      await expect(
        service.assertUsable(businessId, 'COGS'),
      ).resolves.toBeUndefined();
    });

    it('rejects a code the business does not have', async () => {
      await expect(
        service.assertUsable(businessId, 'RENT'),
      ).rejects.toMatchObject({ code: 'UNKNOWN_EXPENSE_CATEGORY' });
    });

    it('rejects an inactive category', async () => {
      repository.findAll.mockResolvedValue([
        cogs,
        makeRow({ is_active: false }),
      ]);

      await expect(
        service.assertUsable(businessId, 'OPERATING'),
      ).rejects.toMatchObject({ code: 'INACTIVE_EXPENSE_CATEGORY' });
    });
  });
});
