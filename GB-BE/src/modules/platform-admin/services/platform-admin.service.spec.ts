import { PlatformAdminService } from './platform-admin.service';

describe('PlatformAdminService', () => {
  let businessesService: { findById: jest.Mock };
  let branchesService: object;
  let rolesService: object;
  let usersService: object;
  let businessFeaturesService: {
    getEffectiveCatalog: jest.Mock;
    setFeature: jest.Mock;
  };
  let platformFeatureFlagsService: {
    getCatalog: jest.Mock;
    setFlag: jest.Mock;
  };
  let auditService: { record: jest.Mock };
  let service: PlatformAdminService;

  const businessId = 'business-1';
  const actorUserId = 'actor-1';

  beforeEach(() => {
    businessesService = {
      findById: jest.fn().mockResolvedValue({ id: businessId }),
    };
    branchesService = {};
    rolesService = {};
    usersService = {};
    businessFeaturesService = {
      getEffectiveCatalog: jest.fn().mockResolvedValue([]),
      setFeature: jest.fn(),
    };
    platformFeatureFlagsService = {
      getCatalog: jest.fn().mockResolvedValue([]),
      setFlag: jest.fn(),
    };
    auditService = { record: jest.fn() };
    service = new PlatformAdminService(
      businessesService as never,
      branchesService as never,
      rolesService as never,
      usersService as never,
      businessFeaturesService as never,
      platformFeatureFlagsService as never,
      auditService as never,
    );
  });

  describe('getFeatures', () => {
    it('validates the business exists and returns the effective catalog', async () => {
      await service.getFeatures(businessId);
      expect(businessesService.findById).toHaveBeenCalledWith(businessId);
      expect(businessFeaturesService.getEffectiveCatalog).toHaveBeenCalledWith(
        businessId,
      );
    });
  });

  describe('setFeature', () => {
    it('delegates to BusinessFeaturesService and records an audit entry when enabling', async () => {
      await service.setFeature(
        businessId,
        'inventory.specializedQueries',
        true,
        actorUserId,
      );

      expect(businessFeaturesService.setFeature).toHaveBeenCalledWith(
        businessId,
        'inventory.specializedQueries',
        true,
      );
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          businessId,
          userId: actorUserId,
          entityType: 'business_feature',
          action: 'PLATFORM_ENABLE_FEATURE',
          newValues: {
            featureKey: 'inventory.specializedQueries',
            enabled: true,
          },
        }),
      );
    });

    // entity_id is a UUID column in audit_logs — a dotted feature key like
    // "inventory.specializedQueries" is not a valid UUID, so it must never be
    // passed as entityId (that insert would silently fail: AuditService.record
    // swallows errors outside a transaction). Regression test for that bug.
    it('never passes the feature key as entityId', async () => {
      await service.setFeature(
        businessId,
        'inventory.specializedQueries',
        true,
        actorUserId,
      );

      const call = auditService.record.mock.calls[0][0];
      expect(call.entityId).toBeUndefined();
    });

    it('records PLATFORM_DISABLE_FEATURE when disabling', async () => {
      await service.setFeature(
        businessId,
        'cash-register.rectification',
        false,
        actorUserId,
      );

      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PLATFORM_DISABLE_FEATURE',
          newValues: {
            featureKey: 'cash-register.rectification',
            enabled: false,
          },
        }),
      );
    });

    it('propagates a rejection from BusinessFeaturesService without recording an audit entry', async () => {
      businessFeaturesService.setFeature.mockRejectedValue(
        new Error('unknown key'),
      );

      await expect(
        service.setFeature(businessId, 'bogus', true, actorUserId),
      ).rejects.toThrow('unknown key');
      expect(auditService.record).not.toHaveBeenCalled();
    });
  });

  describe('getFeatureFlags', () => {
    it('delegates to PlatformFeatureFlagsService.getCatalog', async () => {
      await service.getFeatureFlags();
      expect(platformFeatureFlagsService.getCatalog).toHaveBeenCalled();
    });
  });

  describe('setFeatureFlag', () => {
    const actorBusinessId = 'platform-business-1';

    it("delegates to PlatformFeatureFlagsService and records an audit entry attributed to the actor's own business", async () => {
      await service.setFeatureFlag(
        'inventory.specializedQueries',
        false,
        actorUserId,
        actorBusinessId,
      );

      expect(platformFeatureFlagsService.setFlag).toHaveBeenCalledWith(
        'inventory.specializedQueries',
        false,
      );
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          businessId: actorBusinessId,
          userId: actorUserId,
          entityType: 'platform_feature_flag',
          action: 'PLATFORM_DISABLE_GLOBAL_FEATURE',
          newValues: {
            featureKey: 'inventory.specializedQueries',
            enabled: false,
          },
        }),
      );
    });

    // Same UUID-column pitfall as setFeature — regression test.
    it('never passes the feature key as entityId', async () => {
      await service.setFeatureFlag(
        'inventory.specializedQueries',
        true,
        actorUserId,
        actorBusinessId,
      );

      const call = auditService.record.mock.calls[0][0];
      expect(call.entityId).toBeUndefined();
    });

    it('propagates a rejection from PlatformFeatureFlagsService without recording an audit entry', async () => {
      platformFeatureFlagsService.setFlag.mockRejectedValue(
        new Error('unknown key'),
      );

      await expect(
        service.setFeatureFlag('bogus', true, actorUserId, actorBusinessId),
      ).rejects.toThrow('unknown key');
      expect(auditService.record).not.toHaveBeenCalled();
    });
  });
});
