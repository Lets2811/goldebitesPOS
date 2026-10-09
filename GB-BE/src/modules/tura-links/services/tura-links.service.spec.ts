import { UnauthorizedException } from '@nestjs/common';
import {
  BusinessRuleException,
  EntityNotFoundException,
} from '../../../common/exceptions';
import { UserStatus } from '../../users/domain/user.types';
import { TuraLinkRow } from '../domain/tura-link.interface';
import { TuraLinksService } from './tura-links.service';

describe('TuraLinksService', () => {
  let turaLinksRepository: {
    hasActiveCode: jest.Mock;
    createCode: jest.Mock;
    redeemCode: jest.Mock;
    touchByTokenHash: jest.Mock;
    findActive: jest.Mock;
    findAllActive: jest.Mock;
    revoke: jest.Mock;
  };
  let businessesService: { findById: jest.Mock };
  let businessFeaturesService: { getEnabledKeys: jest.Mock };
  let platformFeatureFlagsService: { getEnabledKeys: jest.Mock };
  let usersService: { findRawById: jest.Mock };
  let rolesService: { findOne: jest.Mock };
  let jwtService: { sign: jest.Mock };
  let service: TuraLinksService;

  const businessId = 'business-1';
  const user = {
    id: 'user-1',
    business_id: businessId,
    branch_id: 'branch-1',
    role_id: 'role-1',
    first_name: 'Carlos',
    last_name: 'Pérez',
    status: UserStatus.ACTIVE,
    deleted_at: null,
  };

  function makeRow(overrides: Partial<TuraLinkRow> = {}): TuraLinkRow {
    return {
      id: 'link-1',
      business_id: businessId,
      user_id: user.id,
      last_used_at: null,
      revoked_at: null,
      created_at: new Date(),
      ...overrides,
    };
  }

  beforeEach(() => {
    turaLinksRepository = {
      hasActiveCode: jest.fn().mockResolvedValue(false),
      createCode: jest.fn().mockResolvedValue(undefined),
      redeemCode: jest.fn().mockResolvedValue(makeRow()),
      touchByTokenHash: jest.fn().mockResolvedValue(makeRow()),
      findActive: jest.fn().mockResolvedValue(makeRow()),
      findAllActive: jest.fn().mockResolvedValue([]),
      revoke: jest.fn().mockResolvedValue(true),
    };
    businessesService = {
      findById: jest
        .fn()
        .mockResolvedValue({ name: 'Golden Bites', isActive: true }),
    };
    businessFeaturesService = {
      getEnabledKeys: jest
        .fn()
        .mockResolvedValue(['orders', 'analytics', 'tura']),
    };
    platformFeatureFlagsService = {
      getEnabledKeys: jest.fn().mockResolvedValue(['orders', 'tura']),
    };
    usersService = { findRawById: jest.fn().mockResolvedValue(user) };
    rolesService = {
      findOne: jest.fn().mockResolvedValue({
        name: 'Cajero',
        permissions: ['orders.read', 'orders.create', 'dashboard.read'],
      }),
    };
    jwtService = { sign: jest.fn().mockReturnValue('signed-token') };
    service = new TuraLinksService(
      turaLinksRepository,
      businessesService as never,
      businessFeaturesService as never,
      platformFeatureFlagsService as never,
      usersService as never,
      rolesService as never,
      jwtService as never,
      {
        getOrThrow: () => ({
          jwt: { accessSecret: 'secret', accessExpiresIn: '15m' },
        }),
      } as never,
    );
  });

  describe('generateCode', () => {
    it('returns a six-digit code for the calling user and stores only its hash', async () => {
      const { code, expiresAt } = await service.generateCode(
        businessId,
        user.id,
      );

      expect(code).toMatch(/^\d{6}$/);
      expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
      expect(turaLinksRepository.createCode).toHaveBeenCalledWith(
        expect.objectContaining({
          createdBy: user.id,
          codeHash: expect.stringMatching(/^[0-9a-f]{64}$/) as string,
        }),
      );
    });

    it('skips a code that is still active for another link', async () => {
      turaLinksRepository.hasActiveCode.mockResolvedValueOnce(true);

      await service.generateCode(businessId, user.id);

      expect(turaLinksRepository.hasActiveCode).toHaveBeenCalledTimes(2);
      expect(turaLinksRepository.createCode).toHaveBeenCalledTimes(1);
    });
  });

  describe('redeemCode', () => {
    it('returns a link token and the user it was linked as', async () => {
      const link = await service.redeemCode('123456');

      expect(link.linkToken).toHaveLength(96);
      expect(link).toMatchObject({
        userName: 'Carlos',
        businessName: 'Golden Bites',
      });
    });

    it('rejects a code that is wrong, used or expired', async () => {
      turaLinksRepository.redeemCode.mockResolvedValue(null);

      await expect(service.redeemCode('000000')).rejects.toThrow(
        BusinessRuleException,
      );
    });
  });

  describe('issueAccessToken', () => {
    it("signs the user's token with only the read permissions TURA may hold", async () => {
      const token = await service.issueAccessToken('link-token');

      expect(token).toMatchObject({
        accessToken: 'signed-token',
        expiresIn: 900,
        userName: 'Carlos',
      });
      expect(jwtService.sign).toHaveBeenCalledWith(
        {
          sub: user.id,
          businessId,
          branchId: 'branch-1',
          roleId: 'role-1',
          roleName: 'Cajero',
          // orders.create is the user's, but TURA never gets to write.
          permissions: ['dashboard.read', 'orders.read'],
          isPlatformAdmin: false,
          // Only what both the business and the platform have enabled.
          enabledFeatures: ['orders', 'tura'],
          mustChangePassword: false,
          turaLinkId: 'link-1',
        },
        expect.anything(),
      );
    });

    it('rejects an unknown or revoked link token', async () => {
      turaLinksRepository.touchByTokenHash.mockResolvedValue(null);

      await expect(service.issueAccessToken('nope')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects a link whose business was deactivated', async () => {
      businessesService.findById.mockResolvedValue({
        name: 'Golden Bites',
        isActive: false,
      });

      await expect(service.issueAccessToken('link-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects a link once the business no longer has TURA', async () => {
      businessFeaturesService.getEnabledKeys.mockResolvedValue(['orders']);

      await expect(service.issueAccessToken('link-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects a link whose user was deactivated or removed', async () => {
      usersService.findRawById.mockResolvedValue({
        ...user,
        status: UserStatus.INACTIVE,
      });
      await expect(service.issueAccessToken('link-token')).rejects.toThrow(
        UnauthorizedException,
      );

      usersService.findRawById.mockResolvedValue(null);
      await expect(service.issueAccessToken('link-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('identify', () => {
    it('fails once the link is revoked', async () => {
      turaLinksRepository.findActive.mockResolvedValue(null);

      await expect(service.identify(businessId, 'link-1')).rejects.toThrow(
        EntityNotFoundException,
      );
    });

    it("fails for a user's own POS token, which is not TURA's", async () => {
      await expect(service.identify(businessId, undefined)).rejects.toThrow(
        EntityNotFoundException,
      );
      expect(turaLinksRepository.findActive).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it("lists each link with its user's full name", async () => {
      turaLinksRepository.findAllActive.mockResolvedValue([
        { ...makeRow(), first_name: 'Carlos', last_name: 'Pérez' },
      ]);

      const [link] = await service.findAll(businessId);

      expect(link).toMatchObject({ userId: user.id, userName: 'Carlos Pérez' });
    });
  });

  describe('revoke', () => {
    it('fails for a link of another business', async () => {
      turaLinksRepository.revoke.mockResolvedValue(false);

      await expect(service.revoke(businessId, 'link-x')).rejects.toThrow(
        EntityNotFoundException,
      );
    });
  });
});
