import { UnauthorizedException } from '@nestjs/common';
import { UserRow } from '../../users/domain/user.interface';
import { UserStatus } from '../../users/domain/user.types';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let usersService: {
    findRawByEmailAcrossBusinesses: jest.Mock;
    findRawByIdUnscoped: jest.Mock;
    findRawById: jest.Mock;
    verifyPassword: jest.Mock;
    setPasswordHash: jest.Mock;
    touchLastLogin: jest.Mock;
    hashPassword: jest.Mock;
  };
  let rolesService: { findOne: jest.Mock };
  let businessFeaturesService: { getEnabledKeys: jest.Mock };
  let platformFeatureFlagsService: { getEnabledKeys: jest.Mock };
  let branchesService: { findOnlyActiveBranchId: jest.Mock };
  let jwtService: { sign: jest.Mock };
  let configService: { getOrThrow: jest.Mock };
  let transactionService: { execute: jest.Mock };
  let auditService: { record: jest.Mock };
  let refreshTokenRepository: {
    create: jest.Mock;
    findByTokenHash: jest.Mock;
    revoke: jest.Mock;
    revokeAllForUser: jest.Mock;
  };
  let passwordResetTokenRepository: {
    create: jest.Mock;
    findByTokenHash: jest.Mock;
    markUsed: jest.Mock;
  };
  let loginAttemptRepository: { record: jest.Mock };
  let service: AuthService;

  const appConfig = {
    jwt: {
      accessSecret: 'access-secret',
      accessExpiresIn: '15m',
      refreshSecret: 'refresh-secret',
      refreshExpiresIn: '7d',
    },
  };

  function makeUserRow(overrides: Partial<UserRow> = {}): UserRow {
    return {
      id: 'user-1',
      business_id: 'business-1',
      branch_id: 'branch-1',
      role_id: 'role-1',
      first_name: 'Ada',
      last_name: 'Lovelace',
      email: 'ada@goldenbites.local',
      password_hash: 'hashed',
      phone: null,
      status: UserStatus.ACTIVE,
      is_platform_admin: false,
      must_change_password: false,
      last_login_at: null,
      created_at: new Date(),
      updated_at: new Date(),
      deleted_at: null,
      ...overrides,
    };
  }

  beforeEach(() => {
    usersService = {
      findRawByEmailAcrossBusinesses: jest.fn(),
      findRawByIdUnscoped: jest.fn(),
      findRawById: jest.fn(),
      verifyPassword: jest.fn(),
      setPasswordHash: jest.fn(),
      touchLastLogin: jest.fn(),
      hashPassword: jest.fn(),
    };
    rolesService = {
      findOne: jest
        .fn()
        .mockResolvedValue({ name: 'OWNER', permissions: ['orders.read'] }),
    };
    businessFeaturesService = {
      getEnabledKeys: jest.fn().mockResolvedValue([]),
    };
    platformFeatureFlagsService = {
      getEnabledKeys: jest.fn().mockResolvedValue([]),
    };
    branchesService = {
      findOnlyActiveBranchId: jest.fn().mockResolvedValue(null),
    };
    jwtService = { sign: jest.fn().mockReturnValue('signed.jwt.token') };
    configService = { getOrThrow: jest.fn().mockReturnValue(appConfig) };
    transactionService = {
      execute: jest.fn((work: (client: unknown) => Promise<unknown>) =>
        work({}),
      ),
    };
    auditService = { record: jest.fn() };
    refreshTokenRepository = {
      create: jest.fn().mockResolvedValue({ id: 'rt-1' }),
      findByTokenHash: jest.fn(),
      revoke: jest.fn(),
      revokeAllForUser: jest.fn(),
    };
    passwordResetTokenRepository = {
      create: jest.fn(),
      findByTokenHash: jest.fn(),
      markUsed: jest.fn(),
    };
    loginAttemptRepository = { record: jest.fn() };

    service = new AuthService(
      usersService as never,
      rolesService as never,
      businessFeaturesService as never,
      platformFeatureFlagsService as never,
      branchesService as never,
      jwtService as never,
      configService as never,
      transactionService as never,
      auditService as never,
      refreshTokenRepository,
      passwordResetTokenRepository,
      loginAttemptRepository,
    );
  });

  describe('login', () => {
    it('issues tokens on valid credentials', async () => {
      usersService.findRawByEmailAcrossBusinesses.mockResolvedValue([
        makeUserRow(),
      ]);
      usersService.verifyPassword.mockResolvedValue(true);

      const result = await service.login(
        { email: 'ada@goldenbites.local', password: 'correct-password' },
        {},
      );

      expect(result.accessToken).toBe('signed.jwt.token');
      expect(result.refreshToken).toEqual(expect.any(String));
      expect(result.user.roleName).toBe('OWNER');
      expect(usersService.touchLastLogin).toHaveBeenCalledWith('user-1');
      expect(loginAttemptRepository.record).toHaveBeenCalledWith(
        expect.objectContaining({ success: true }),
      );
    });

    it('enabledFeatures is the intersection of the business catalog and the platform-wide flags — a key the business enabled but the platform killed globally is excluded', async () => {
      usersService.findRawByEmailAcrossBusinesses.mockResolvedValue([
        makeUserRow(),
      ]);
      usersService.verifyPassword.mockResolvedValue(true);
      businessFeaturesService.getEnabledKeys.mockResolvedValue([
        'inventory',
        'inventory.specializedQueries',
      ]);
      platformFeatureFlagsService.getEnabledKeys.mockResolvedValue([
        'inventory',
      ]);

      await service.login(
        { email: 'ada@goldenbites.local', password: 'correct-password' },
        {},
      );

      const [payload] = jwtService.sign.mock.calls[0];
      expect(payload.enabledFeatures).toEqual(['inventory']);
      expect(payload.enabledFeatures).not.toContain(
        'inventory.specializedQueries',
      );
    });

    it('places a user with no branch at the only branch of a single-site business', async () => {
      usersService.findRawByEmailAcrossBusinesses.mockResolvedValue([
        makeUserRow({ branch_id: null }),
      ]);
      usersService.verifyPassword.mockResolvedValue(true);
      branchesService.findOnlyActiveBranchId.mockResolvedValue('only-branch');

      const result = await service.login(
        { email: 'ada@goldenbites.local', password: 'correct-password' },
        {},
      );

      expect(result.user.branchId).toBe('only-branch');
      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({ branchId: 'only-branch' }),
        expect.anything(),
      );
    });

    it("keeps a user's own branch, and leaves one with none unassigned at a business with several", async () => {
      usersService.verifyPassword.mockResolvedValue(true);

      usersService.findRawByEmailAcrossBusinesses.mockResolvedValue([
        makeUserRow({ branch_id: 'own-branch' }),
      ]);
      const assigned = await service.login(
        { email: 'ada@goldenbites.local', password: 'correct-password' },
        {},
      );
      expect(assigned.user.branchId).toBe('own-branch');
      expect(branchesService.findOnlyActiveBranchId).not.toHaveBeenCalled();

      // findOnlyActiveBranchId answers null when the business has several.
      usersService.findRawByEmailAcrossBusinesses.mockResolvedValue([
        makeUserRow({ branch_id: null }),
      ]);
      const unassigned = await service.login(
        { email: 'ada@goldenbites.local', password: 'correct-password' },
        {},
      );
      expect(unassigned.user.branchId).toBeNull();
    });

    it('rejects when no user matches the email', async () => {
      usersService.findRawByEmailAcrossBusinesses.mockResolvedValue([]);

      await expect(
        service.login({ email: 'nobody@goldenbites.local', password: 'x' }, {}),
      ).rejects.toThrow(UnauthorizedException);
      expect(loginAttemptRepository.record).toHaveBeenCalledWith(
        expect.objectContaining({ success: false }),
      );
    });

    it('rejects (without leaking which email) when the email is ambiguous across businesses', async () => {
      usersService.findRawByEmailAcrossBusinesses.mockResolvedValue([
        makeUserRow(),
        makeUserRow({ id: 'user-2' }),
      ]);

      await expect(
        service.login({ email: 'ada@goldenbites.local', password: 'x' }, {}),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects when the account is not ACTIVE', async () => {
      usersService.findRawByEmailAcrossBusinesses.mockResolvedValue([
        makeUserRow({ status: UserStatus.BLOCKED }),
      ]);

      await expect(
        service.login({ email: 'ada@goldenbites.local', password: 'x' }, {}),
      ).rejects.toThrow(UnauthorizedException);
      expect(usersService.verifyPassword).not.toHaveBeenCalled();
    });

    it('rejects on an incorrect password', async () => {
      usersService.findRawByEmailAcrossBusinesses.mockResolvedValue([
        makeUserRow(),
      ]);
      usersService.verifyPassword.mockResolvedValue(false);

      await expect(
        service.login(
          { email: 'ada@goldenbites.local', password: 'wrong' },
          {},
        ),
      ).rejects.toThrow(UnauthorizedException);
      expect(usersService.touchLastLogin).not.toHaveBeenCalled();
    });
  });

  describe('refresh', () => {
    it('rotates the refresh token and issues a new access token', async () => {
      refreshTokenRepository.findByTokenHash.mockResolvedValue({
        id: 'rt-1',
        user_id: 'user-1',
        revoked_at: null,
        expires_at: new Date(Date.now() + 60_000),
      });
      usersService.findRawByIdUnscoped.mockResolvedValue(makeUserRow());

      const result = await service.refresh('raw-refresh-token', {});

      expect(refreshTokenRepository.revoke).toHaveBeenCalledWith('rt-1');
      expect(result.accessToken).toBe('signed.jwt.token');
    });

    it('rejects an unknown refresh token', async () => {
      refreshTokenRepository.findByTokenHash.mockResolvedValue(null);

      await expect(service.refresh('unknown-token', {})).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects an expired refresh token', async () => {
      refreshTokenRepository.findByTokenHash.mockResolvedValue({
        id: 'rt-1',
        user_id: 'user-1',
        revoked_at: null,
        expires_at: new Date(Date.now() - 60_000),
      });

      await expect(service.refresh('expired-token', {})).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects a revoked refresh token', async () => {
      refreshTokenRepository.findByTokenHash.mockResolvedValue({
        id: 'rt-1',
        user_id: 'user-1',
        revoked_at: new Date(),
        expires_at: new Date(Date.now() + 60_000),
      });

      await expect(service.refresh('revoked-token', {})).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('changePassword', () => {
    it('updates the password and revokes existing sessions', async () => {
      usersService.findRawById.mockResolvedValue(makeUserRow());
      usersService.verifyPassword.mockResolvedValue(true);

      await service.changePassword('user-1', 'business-1', {
        currentPassword: 'old',
        newPassword: 'new-password',
      });

      expect(usersService.setPasswordHash).toHaveBeenCalledWith(
        'user-1',
        'new-password',
        false,
      );
      expect(refreshTokenRepository.revokeAllForUser).toHaveBeenCalledWith(
        'user-1',
      );
    });

    it('rejects when the current password is wrong', async () => {
      usersService.findRawById.mockResolvedValue(makeUserRow());
      usersService.verifyPassword.mockResolvedValue(false);

      await expect(
        service.changePassword('user-1', 'business-1', {
          currentPassword: 'wrong',
          newPassword: 'new-password',
        }),
      ).rejects.toThrow(UnauthorizedException);
      expect(usersService.setPasswordHash).not.toHaveBeenCalled();
    });
  });

  describe('forgotPassword / resetPassword', () => {
    it('creates a reset token when exactly one account matches the email', async () => {
      usersService.findRawByEmailAcrossBusinesses.mockResolvedValue([
        makeUserRow(),
      ]);

      await service.forgotPassword({ email: 'ada@goldenbites.local' });

      expect(passwordResetTokenRepository.create).toHaveBeenCalled();
    });

    it('silently no-ops when the email is unknown (avoids account enumeration)', async () => {
      usersService.findRawByEmailAcrossBusinesses.mockResolvedValue([]);

      await service.forgotPassword({ email: 'nobody@goldenbites.local' });

      expect(passwordResetTokenRepository.create).not.toHaveBeenCalled();
    });

    it('resetPassword rejects an invalid or expired token', async () => {
      passwordResetTokenRepository.findByTokenHash.mockResolvedValue(null);

      await expect(
        service.resetPassword({
          token: 'bad-token',
          newPassword: 'new-password',
        }),
      ).rejects.toThrow();
    });

    it('resetPassword updates the password when the token is valid', async () => {
      passwordResetTokenRepository.findByTokenHash.mockResolvedValue({
        id: 'prt-1',
        user_id: 'user-1',
        used_at: null,
        expires_at: new Date(Date.now() + 60_000),
      });

      await service.resetPassword({
        token: 'good-token',
        newPassword: 'new-password',
      });

      expect(usersService.setPasswordHash).toHaveBeenCalledWith(
        'user-1',
        'new-password',
        false,
        {},
      );
      expect(passwordResetTokenRepository.markUsed).toHaveBeenCalledWith(
        'prt-1',
        {},
      );
      expect(refreshTokenRepository.revokeAllForUser).toHaveBeenCalledWith(
        'user-1',
        {},
      );
    });
  });

  describe('logout', () => {
    it('revokes the refresh token when found', async () => {
      refreshTokenRepository.findByTokenHash.mockResolvedValue({
        id: 'rt-1',
        revoked_at: null,
      });

      await service.logout('raw-token');

      expect(refreshTokenRepository.revoke).toHaveBeenCalledWith('rt-1');
    });

    it('is a no-op when the token is unknown', async () => {
      refreshTokenRepository.findByTokenHash.mockResolvedValue(null);

      await service.logout('unknown-token');

      expect(refreshTokenRepository.revoke).not.toHaveBeenCalled();
    });
  });
});
