import {
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomBytes, createHash } from 'node:crypto';
import { DomainException } from '../../../common/exceptions';
import { parseDurationMs } from '../../../common/utils/duration.util';
import { AppConfig } from '../../../config/app.config';
import { TransactionService } from '../../../database/transaction.service';
import { AuditService } from '../../audit/services/audit.service';
import { BusinessFeaturesService } from '../../business-features/services/business-features.service';
import { BranchesService } from '../../branches/services/branches.service';
import { PlatformFeatureFlagsService } from '../../platform-feature-flags/services/platform-feature-flags.service';
import { RolesService } from '../../roles/services/roles.service';
import { UserRow } from '../../users/domain/user.interface';
import { UserStatus } from '../../users/domain/user.types';
import { UsersService } from '../../users/services/users.service';
import {
  AuthTokens,
  AuthenticatedProfile,
  JwtPayload,
} from '../domain/auth.types';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { ForgotPasswordDto } from '../dto/forgot-password.dto';
import { LoginDto } from '../dto/login.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { LOGIN_ATTEMPT_REPOSITORY } from '../repositories/login-attempt.repository.interface';
import type { ILoginAttemptRepository } from '../repositories/login-attempt.repository.interface';
import { PASSWORD_RESET_TOKEN_REPOSITORY } from '../repositories/password-reset-token.repository.interface';
import type { IPasswordResetTokenRepository } from '../repositories/password-reset-token.repository.interface';
import { REFRESH_TOKEN_REPOSITORY } from '../repositories/refresh-token.repository.interface';
import type { IRefreshTokenRepository } from '../repositories/refresh-token.repository.interface';

export interface RequestMetadata {
  ipAddress?: string;
  userAgent?: string;
}

const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const INVALID_CREDENTIALS_MESSAGE = 'Invalid email or password';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly rolesService: RolesService,
    private readonly businessFeaturesService: BusinessFeaturesService,
    private readonly platformFeatureFlagsService: PlatformFeatureFlagsService,
    private readonly branchesService: BranchesService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly transactionService: TransactionService,
    private readonly auditService: AuditService,
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly refreshTokenRepository: IRefreshTokenRepository,
    @Inject(PASSWORD_RESET_TOKEN_REPOSITORY)
    private readonly passwordResetTokenRepository: IPasswordResetTokenRepository,
    @Inject(LOGIN_ATTEMPT_REPOSITORY)
    private readonly loginAttemptRepository: ILoginAttemptRepository,
  ) {}

  async login(
    dto: LoginDto,
    meta: RequestMetadata,
  ): Promise<AuthTokens & { user: AuthenticatedProfile }> {
    const candidates = await this.usersService.findRawByEmailAcrossBusinesses(
      dto.email,
    );

    if (candidates.length !== 1) {
      if (candidates.length > 1) {
        this.logger.warn(
          `Ambiguous login: "${dto.email}" matches ${candidates.length} accounts`,
        );
      }
      await this.loginAttemptRepository.record({
        email: dto.email,
        success: false,
        ...meta,
      });
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }

    const user = candidates[0];

    if (user.status !== UserStatus.ACTIVE) {
      await this.loginAttemptRepository.record({
        email: dto.email,
        userId: user.id,
        success: false,
        ...meta,
      });
      throw new UnauthorizedException(
        'Your account is not active. Contact your administrator.',
      );
    }

    const passwordValid = await this.usersService.verifyPassword(
      dto.password,
      user.password_hash,
    );
    if (!passwordValid) {
      await this.loginAttemptRepository.record({
        email: dto.email,
        userId: user.id,
        success: false,
        ...meta,
      });
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }

    const tokens = await this.issueTokens(user, meta);

    await this.usersService.touchLastLogin(user.id);
    await this.loginAttemptRepository.record({
      email: dto.email,
      userId: user.id,
      success: true,
      ...meta,
    });
    await this.auditService.record({
      businessId: user.business_id,
      branchId: user.branch_id,
      userId: user.id,
      entityType: 'auth',
      entityId: user.id,
      action: 'LOGIN_SUCCESS',
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return { ...tokens, user: await this.buildProfile(user) };
  }

  async refresh(
    refreshToken: string,
    meta: RequestMetadata,
  ): Promise<AuthTokens & { user: AuthenticatedProfile }> {
    const tokenHash = this.hashToken(refreshToken);
    const record = await this.refreshTokenRepository.findByTokenHash(tokenHash);

    if (
      !record ||
      record.revoked_at ||
      record.expires_at.getTime() < Date.now()
    ) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.usersService.findRawByIdUnscoped(record.user_id);
    if (!user || user.status !== UserStatus.ACTIVE) {
      await this.refreshTokenRepository.revoke(record.id);
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    await this.refreshTokenRepository.revoke(record.id);
    const tokens = await this.issueTokens(user, meta);

    await this.auditService.record({
      businessId: user.business_id,
      branchId: user.branch_id,
      userId: user.id,
      entityType: 'auth',
      entityId: user.id,
      action: 'TOKEN_REFRESH',
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return { ...tokens, user: await this.buildProfile(user) };
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);
    const record = await this.refreshTokenRepository.findByTokenHash(tokenHash);
    if (record && !record.revoked_at) {
      await this.refreshTokenRepository.revoke(record.id);
    }
  }

  async changePassword(
    userId: string,
    businessId: string,
    dto: ChangePasswordDto,
  ): Promise<void> {
    const user = await this.usersService.findRawById(userId, businessId);
    if (!user) {
      throw new UnauthorizedException();
    }

    const valid = await this.usersService.verifyPassword(
      dto.currentPassword,
      user.password_hash,
    );
    if (!valid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    await this.usersService.setPasswordHash(userId, dto.newPassword, false);
    await this.refreshTokenRepository.revokeAllForUser(userId);

    await this.auditService.record({
      businessId,
      userId,
      entityType: 'auth',
      entityId: userId,
      action: 'PASSWORD_CHANGE',
    });
  }

  /** Always responds the same regardless of whether the email exists, to avoid account enumeration. */
  async forgotPassword(dto: ForgotPasswordDto): Promise<void> {
    const candidates = await this.usersService.findRawByEmailAcrossBusinesses(
      dto.email,
    );

    if (candidates.length !== 1) {
      return;
    }

    const user = candidates[0];
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);

    await this.passwordResetTokenRepository.create({
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS),
    });

    // No email transport is wired yet (see README) — log so the token can be
    // retrieved manually in development.
    this.logger.warn(
      `Password reset requested for ${user.email}. Token: ${rawToken}`,
    );
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const tokenHash = this.hashToken(dto.token);
    const record =
      await this.passwordResetTokenRepository.findByTokenHash(tokenHash);

    if (!record || record.used_at || record.expires_at.getTime() < Date.now()) {
      throw new DomainException({
        code: 'INVALID_RESET_TOKEN',
        message: 'This password reset link is invalid or has expired',
        status: HttpStatus.UNPROCESSABLE_ENTITY,
      });
    }

    await this.transactionService.execute(async (client) => {
      await this.usersService.setPasswordHash(
        record.user_id,
        dto.newPassword,
        false,
        client,
      );
      await this.passwordResetTokenRepository.markUsed(record.id, client);
      await this.refreshTokenRepository.revokeAllForUser(
        record.user_id,
        client,
      );
      await this.auditService.record(
        {
          userId: record.user_id,
          entityType: 'auth',
          entityId: record.user_id,
          action: 'PASSWORD_RESET',
        },
        client,
      );
    });
  }

  private async issueTokens(
    user: UserRow,
    meta: RequestMetadata,
  ): Promise<AuthTokens> {
    const role = await this.rolesService.findOne(
      user.business_id,
      user.role_id,
    );
    // enabledFeatures is the intersection of two independent axes: what the
    // business has enabled for itself (BusinessFeaturesService) AND what the
    // platform hasn't killed globally for everyone (PlatformFeatureFlagsService).
    const [businessEnabledKeys, globallyEnabledKeys] = await Promise.all([
      this.businessFeaturesService.getEnabledKeys(user.business_id),
      this.platformFeatureFlagsService.getEnabledKeys(),
    ]);
    const globallyEnabledSet = new Set(globallyEnabledKeys);
    const enabledFeatures = businessEnabledKeys.filter((key) =>
      globallyEnabledSet.has(key),
    );

    const payload: JwtPayload = {
      sub: user.id,
      businessId: user.business_id,
      branchId: await this.resolveBranchId(user),
      roleId: user.role_id,
      roleName: role.name,
      permissions: role.permissions,
      isPlatformAdmin: user.is_platform_admin,
      enabledFeatures,
      mustChangePassword: user.must_change_password,
    };

    const appConfig = this.configService.getOrThrow<AppConfig>('app');
    const accessToken = this.jwtService.sign(payload, {
      secret: appConfig.jwt.accessSecret,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- see auth.module.ts
      expiresIn: appConfig.jwt.accessExpiresIn as any,
    });

    const rawRefreshToken = randomBytes(48).toString('hex');
    const refreshExpiresAt = new Date(
      Date.now() + parseDurationMs(appConfig.jwt.refreshExpiresIn),
    );

    await this.refreshTokenRepository.create({
      userId: user.id,
      tokenHash: this.hashToken(rawRefreshToken),
      expiresAt: refreshExpiresAt,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      expiresIn: Math.floor(
        parseDurationMs(appConfig.jwt.accessExpiresIn) / 1000,
      ),
    };
  }

  private async buildProfile(user: UserRow): Promise<AuthenticatedProfile> {
    const role = await this.rolesService.findOne(
      user.business_id,
      user.role_id,
    );
    return {
      id: user.id,
      businessId: user.business_id,
      branchId: await this.resolveBranchId(user),
      roleId: user.role_id,
      roleName: role.name,
      firstName: user.first_name,
      lastName: user.last_name,
      email: user.email,
      mustChangePassword: user.must_change_password,
    };
  }

  /**
   * The branch a user works at. Someone assigned to none, at a business with
   * a single branch, works at that one: branches are an add-on, and a
   * business without it should not have to assign its people to anything.
   * At a business with several, an unassigned user stays unassigned.
   */
  private async resolveBranchId(user: UserRow): Promise<string | null> {
    return (
      user.branch_id ??
      (await this.branchesService.findOnlyActiveBranchId(user.business_id))
    );
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
