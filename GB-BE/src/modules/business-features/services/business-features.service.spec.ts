import { EntityNotFoundException } from '../../../common/exceptions';
import { BusinessFeaturesService } from './business-features.service';

describe('BusinessFeaturesService', () => {
  let repository: {
    findDisabledKeys: jest.Mock;
    findEnabledKeys: jest.Mock;
    setEnabled: jest.Mock;
  };
  let service: BusinessFeaturesService;

  const businessId = 'business-1';

  beforeEach(() => {
    repository = {
      findDisabledKeys: jest.fn().mockResolvedValue([]),
      findEnabledKeys: jest.fn().mockResolvedValue([]),
      setEnabled: jest.fn(),
    };
    service = new BusinessFeaturesService(repository);
  });

  describe('getEnabledKeys', () => {
    it('returns every module and sub-feature key when nothing is disabled', async () => {
      const keys = await service.getEnabledKeys(businessId);
      expect(keys).toContain('inventory');
      expect(keys).toContain('inventory.specializedQueries');
      expect(keys).toContain('cash-register');
      expect(keys).toContain('cash-register.rectification');
    });

    it('excludes a sub-feature explicitly disabled, but keeps its sibling and parent module', async () => {
      repository.findDisabledKeys.mockResolvedValue([
        'inventory.specializedQueries',
      ]);
      const keys = await service.getEnabledKeys(businessId);
      expect(keys).toContain('inventory');
      expect(keys).not.toContain('inventory.specializedQueries');
    });

    it('cascades: disabling the parent module excludes its sub-feature even though the sub-feature itself was never disabled', async () => {
      repository.findDisabledKeys.mockResolvedValue(['inventory']);
      const keys = await service.getEnabledKeys(businessId);
      expect(keys).not.toContain('inventory');
      expect(keys).not.toContain('inventory.specializedQueries');
    });
  });

  describe('opt-in modules (paid add-ons)', () => {
    it('are off for a business that was never given them', async () => {
      const keys = await service.getEnabledKeys(businessId);
      expect(keys).not.toContain('tura');

      const catalog = await service.getEffectiveCatalog(businessId);
      expect(catalog.find((module) => module.key === 'tura')?.enabled).toBe(
        false,
      );
    });

    it('are on once the business has a row turning them on', async () => {
      repository.findEnabledKeys.mockResolvedValue(['tura']);
      const keys = await service.getEnabledKeys(businessId);
      expect(keys).toContain('tura');
    });

    it('go off again when that row is turned off', async () => {
      repository.findDisabledKeys.mockResolvedValue(['tura']);
      const keys = await service.getEnabledKeys(businessId);
      expect(keys).not.toContain('tura');
    });
  });

  describe('getEffectiveCatalog', () => {
    it('reflects cascade in the nested subFeatures entries', async () => {
      repository.findDisabledKeys.mockResolvedValue(['inventory']);
      const catalog = await service.getEffectiveCatalog(businessId);

      const inventory = catalog.find((f) => f.key === 'inventory');
      expect(inventory?.enabled).toBe(false);
      expect(
        inventory?.subFeatures?.find(
          (s) => s.key === 'inventory.specializedQueries',
        )?.enabled,
      ).toBe(false);
    });

    it('a sub-feature disabled on its own row still shows enabled=false while the parent module stays enabled', async () => {
      repository.findDisabledKeys.mockResolvedValue([
        'inventory.specializedQueries',
      ]);
      const catalog = await service.getEffectiveCatalog(businessId);

      const inventory = catalog.find((f) => f.key === 'inventory');
      expect(inventory?.enabled).toBe(true);
      expect(
        inventory?.subFeatures?.find(
          (s) => s.key === 'inventory.specializedQueries',
        )?.enabled,
      ).toBe(false);
    });

    it('modules without sub-features omit the subFeatures field', async () => {
      const catalog = await service.getEffectiveCatalog(businessId);
      const orders = catalog.find((f) => f.key === 'orders');
      expect(orders?.subFeatures).toBeUndefined();
    });
  });

  describe('setFeature', () => {
    it('delegates to the repository for a valid module key', async () => {
      await service.setFeature(businessId, 'inventory', false);
      expect(repository.setEnabled).toHaveBeenCalledWith(
        businessId,
        'inventory',
        false,
      );
    });

    it('delegates to the repository for a valid sub-feature key', async () => {
      await service.setFeature(
        businessId,
        'inventory.specializedQueries',
        false,
      );
      expect(repository.setEnabled).toHaveBeenCalledWith(
        businessId,
        'inventory.specializedQueries',
        false,
      );
    });

    it('rejects an unknown key without touching the repository', async () => {
      await expect(
        service.setFeature(businessId, 'inventory.bogus', false),
      ).rejects.toThrow(EntityNotFoundException);
      expect(repository.setEnabled).not.toHaveBeenCalled();
    });
  });
});
