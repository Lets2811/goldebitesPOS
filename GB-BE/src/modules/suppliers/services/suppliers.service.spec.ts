import { EntityNotFoundException } from '../../../common/exceptions';
import { SupplierRow } from '../domain/supplier.interface';
import { SuppliersService } from './suppliers.service';

describe('SuppliersService', () => {
  let repository: {
    create: jest.Mock;
    findById: jest.Mock;
    findAll: jest.Mock;
    update: jest.Mock;
    setActive: jest.Mock;
    findActiveByName: jest.Mock;
  };
  let auditService: { record: jest.Mock };
  let service: SuppliersService;

  const businessId = 'business-1';

  function makeRow(overrides: Partial<SupplierRow> = {}): SupplierRow {
    return {
      id: 'supplier-1',
      business_id: businessId,
      name: 'Acme Foods',
      tax_id: null,
      contact_name: null,
      email: null,
      phone: null,
      address: null,
      notes: null,
      credit_days: null,
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
      findActiveByName: jest.fn().mockResolvedValue(null),
    };
    auditService = { record: jest.fn() };
    service = new SuppliersService(repository, auditService as never);
  });

  describe('findOrCreateByName()', () => {
    it('reuses the active supplier already called that, without creating another', async () => {
      repository.findActiveByName.mockResolvedValue(makeRow({ name: 'Acme Foods' }));

      const supplier = await service.findOrCreateByName(businessId, '  acme foods ');

      expect(supplier.name).toBe('Acme Foods');
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('creates the supplier when none has that name', async () => {
      repository.create.mockResolvedValue(makeRow({ name: 'Nuevo Proveedor' }));

      await service.findOrCreateByName(businessId, '  Nuevo Proveedor ');

      expect(repository.create).toHaveBeenCalledWith({ businessId, name: 'Nuevo Proveedor' });
    });
  });

  it('create() does not check for name uniqueness (schema allows duplicates)', async () => {
    repository.create.mockResolvedValue(makeRow());

    const supplier = await service.create({ businessId, name: 'Acme Foods' });

    expect(supplier.name).toBe('Acme Foods');
    expect(repository.create).toHaveBeenCalledWith({
      businessId,
      name: 'Acme Foods',
    });
  });

  describe('update', () => {
    it('throws EntityNotFoundException when not owned by the business', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.update(businessId, 'supplier-1', { name: 'New' }),
      ).rejects.toThrow(EntityNotFoundException);
    });

    it('updates and audits on success', async () => {
      repository.findById.mockResolvedValue(makeRow());
      repository.update.mockResolvedValue(makeRow({ contact_name: 'Jane' }));

      const result = await service.update(
        businessId,
        'supplier-1',
        { contactName: 'Jane' },
        'actor-1',
      );

      expect(result.contactName).toBe('Jane');
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'UPDATE' }),
      );
    });
  });

  describe('setActive', () => {
    it('throws EntityNotFoundException when the row disappears mid-update', async () => {
      repository.findById.mockResolvedValue(makeRow());
      repository.setActive.mockResolvedValue(null);

      await expect(
        service.setActive(businessId, 'supplier-1', false),
      ).rejects.toThrow(EntityNotFoundException);
    });
  });
});
