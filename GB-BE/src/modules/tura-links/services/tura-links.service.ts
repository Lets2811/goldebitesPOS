import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes, randomInt } from 'node:crypto';
import {
  BusinessRuleException,
  EntityNotFoundException,
} from '../../../common/exceptions';
import { parseDurationMs } from '../../../common/utils/duration.util';
import { AppConfig } from '../../../config/app.config';
import { AuditService } from '../../audit/services/audit.service';
import { JwtPayload } from '../../auth/domain/auth.types';
import { BusinessFeaturesService } from '../../business-features/services/business-features.service';
import { BusinessesService } from '../../businesses/services/businesses.service';
import { PlatformFeatureFlagsService } from '../../platform-feature-flags/services/platform-feature-flags.service';
import { RolesService } from '../../roles/services/roles.service';
import { UserRow } from '../../users/domain/user.interface';
import { UserStatus } from '../../users/domain/user.types';
import { UsersService } from '../../users/services/users.service';
import {
  PlatformTuraStatus,
  TuraLink,
  TuraLinkRow,
} from '../domain/tura-link.interface';
import {
  RedeemedTuraLink,
  TuraAccessToken,
  TuraLinkCode,
  TuraLinkIdentity,
} from '../domain/tura-link.types';
import type { ITuraLinksRepository } from '../repositories/tura-links.repository.interface';
import { TURA_LINKS_REPOSITORY } from '../repositories/tura-links.repository.interface';

/** The module a business has to have been given for any of this to work. */
export const TURA_FEATURE = 'tura';

/**
 * Everything TURA may do, whoever it acts for: of the user's own permissions
 * it only ever gets the ones listed here. All read-only on purpose. The link
 * token lives for a long time on the user's phone, and TURA only answers
 * questions, so it has no business holding a permission that changes data.
 */
export const TURA_PERMISSIONS = [
  'dashboard.read',
  'analytics.read',
  'orders.read',
  'inventory.read',
  'products.read',
];

const CODE_LENGTH = 6;
const CODE_TTL_MS = 10 * 60 * 1000;
const CODE_ATTEMPTS = 5;

/** A link checked against everything that can take its access away. */
interface ResolvedLink {
  identity: TuraLinkIdentity;
  user: UserRow;
  roleName: string;
  permissions: string[];
  enabledFeatures: string[];
}

@Injectable()
export class TuraLinksService {
  constructor(
    @Inject(TURA_LINKS_REPOSITORY)
    private readonly turaLinksRepository: ITuraLinksRepository,
    private readonly businessesService: BusinessesService,
    private readonly businessFeaturesService: BusinessFeaturesService,
    private readonly platformFeatureFlagsService: PlatformFeatureFlagsService,
    private readonly usersService: UsersService,
    private readonly rolesService: RolesService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {}

  /** A code that links TURA to the user generating it. */
  async generateCode(
    businessId: string,
    actorUserId: string,
  ): Promise<TuraLinkCode> {
    // The code alone has to identify the business and the user, so it must
    // not collide with another code that is still valid, whoever it belongs to.
    for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt++) {
      const code = randomInt(0, 10 ** CODE_LENGTH)
        .toString()
        .padStart(CODE_LENGTH, '0');
      const codeHash = this.hash(code);
      if (await this.turaLinksRepository.hasActiveCode(codeHash)) {
        continue;
      }
      const expiresAt = new Date(Date.now() + CODE_TTL_MS);
      await this.turaLinksRepository.createCode({
        businessId,
        codeHash,
        createdBy: actorUserId,
        expiresAt,
      });
      return { code, expiresAt };
    }
    throw new BusinessRuleException(
      'Could not generate a link code, try again',
      'TURA_LINK_CODE_UNAVAILABLE',
    );
  }

  async redeemCode(code: string): Promise<RedeemedTuraLink> {
    const linkToken = randomBytes(48).toString('hex');
    const link = await this.turaLinksRepository.redeemCode({
      codeHash: this.hash(code),
      tokenHash: this.hash(linkToken),
    });
    if (!link) {
      throw new BusinessRuleException(
        'El código no es válido o ya venció',
        'TURA_LINK_CODE_INVALID',
      );
    }
    const { identity } = await this.resolve(link);
    return { linkToken, ...identity };
  }

  async issueAccessToken(linkToken: string): Promise<TuraAccessToken> {
    const link = await this.turaLinksRepository.touchByTokenHash(
      this.hash(linkToken),
    );
    if (!link) {
      throw new UnauthorizedException('Invalid or revoked TURA link');
    }
    const { identity, user, roleName, permissions, enabledFeatures } =
      await this.resolve(link);

    // The user's own token (see AuthService.issueTokens) with fewer
    // permissions, so every guard treats TURA as that user. turaLinkId is
    // what tells the two apart, and what lets a revoked link be refused
    // before its token expires.
    const payload: JwtPayload = {
      sub: user.id,
      businessId: link.business_id,
      branchId: user.branch_id,
      roleId: user.role_id,
      roleName,
      permissions,
      isPlatformAdmin: false,
      enabledFeatures,
      mustChangePassword: false,
      turaLinkId: link.id,
    };

    const { jwt } = this.configService.getOrThrow<AppConfig>('app');
    const accessToken = this.jwtService.sign(payload, {
      secret: jwt.accessSecret,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- see tura-links.module.ts
      expiresIn: jwt.accessExpiresIn as any,
    });

    return {
      accessToken,
      expiresIn: Math.floor(parseDurationMs(jwt.accessExpiresIn) / 1000),
      ...identity,
    };
  }

  /** The link behind an access token. Fails once the link is revoked, even while the token is still valid. */
  async identify(
    businessId: string,
    linkId: string | undefined,
  ): Promise<TuraLinkIdentity> {
    const link = linkId
      ? await this.turaLinksRepository.findActive(businessId, linkId)
      : null;
    if (!link) {
      throw new EntityNotFoundException('TuraLink', linkId);
    }
    return (await this.resolve(link)).identity;
  }

  async findAll(businessId: string): Promise<TuraLink[]> {
    const rows = await this.turaLinksRepository.findAllActive(businessId);
    return rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      userName: `${row.first_name} ${row.last_name}`.trim(),
      createdAt: row.created_at,
      lastUsedAt: row.last_used_at,
    }));
  }

  async revoke(businessId: string, id: string): Promise<void> {
    const revoked = await this.turaLinksRepository.revoke(businessId, id);
    if (!revoked) {
      throw new EntityNotFoundException('TuraLink', id);
    }
  }

  /** For the platform admin: whether the business has TURA, and who is linked to it. */
  async getPlatformStatus(businessId: string): Promise<PlatformTuraStatus> {
    await this.businessesService.findById(businessId);
    const [enabledFeatures, links] = await Promise.all([
      this.enabledFeatures(businessId),
      this.findAll(businessId),
    ]);
    return { enabled: enabledFeatures.includes(TURA_FEATURE), links };
  }

  /**
   * A code generated by a platform admin that links TURA to one of the
   * business's users, for setting a business up without its staff having to
   * do it. The link acts as that user, exactly as if they had generated it.
   */
  async generateCodeForUser(
    businessId: string,
    userId: string,
    actorUserId: string,
  ): Promise<TuraLinkCode> {
    const business = await this.businessesService.findById(businessId);
    if (!business.isActive) {
      throw new BusinessRuleException(
        'La empresa está inactiva',
        'TURA_BUSINESS_INACTIVE',
      );
    }
    if (!(await this.enabledFeatures(businessId)).includes(TURA_FEATURE)) {
      throw new BusinessRuleException(
        'La empresa no tiene el módulo TURA activo',
        'TURA_NOT_ENABLED',
      );
    }
    const user = await this.usersService.findRawById(userId, businessId);
    if (!user || user.deleted_at) {
      throw new EntityNotFoundException('User', userId);
    }
    if (user.status !== UserStatus.ACTIVE) {
      throw new BusinessRuleException(
        'El usuario no está activo',
        'TURA_USER_INACTIVE',
      );
    }

    const code = await this.generateCode(businessId, userId);
    await this.auditService.record({
      businessId,
      userId: actorUserId,
      entityType: 'tura_link_code',
      action: 'PLATFORM_GENERATE_TURA_CODE',
      newValues: { forUserId: userId },
    });
    return code;
  }

  async revokeForPlatform(
    businessId: string,
    id: string,
    actorUserId: string,
  ): Promise<void> {
    await this.revoke(businessId, id);
    await this.auditService.record({
      businessId,
      userId: actorUserId,
      entityType: 'tura_link',
      entityId: id,
      action: 'PLATFORM_REVOKE_TURA_LINK',
    });
  }

  /**
   * Who a link acts as and what it may do, right now. Everything that can
   * take TURA away is checked here, on every exchange: the business being
   * active, the business still having the module, and the user still being
   * an active user. The permissions are the user's current ones, so a change
   * of role reaches TURA with the next token.
   */
  private async resolve(link: TuraLinkRow): Promise<ResolvedLink> {
    const [business, enabledFeatures, user] = await Promise.all([
      this.businessesService.findById(link.business_id),
      this.enabledFeatures(link.business_id),
      this.usersService.findRawById(link.user_id, link.business_id),
    ]);
    if (!business.isActive) {
      throw new UnauthorizedException('This business is not active');
    }
    if (!enabledFeatures.includes(TURA_FEATURE)) {
      throw new UnauthorizedException('TURA is not enabled for this business');
    }
    if (!user || user.deleted_at || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('This user is no longer active');
    }

    const role = await this.rolesService.findOne(
      link.business_id,
      user.role_id,
    );
    const granted = new Set(role.permissions);
    return {
      identity: { userName: user.first_name, businessName: business.name },
      user,
      roleName: role.name,
      permissions: TURA_PERMISSIONS.filter((code) => granted.has(code)),
      enabledFeatures,
    };
  }

  /** The business's modules that are also switched on platform-wide. */
  private async enabledFeatures(businessId: string): Promise<string[]> {
    const [businessEnabledKeys, globallyEnabledKeys] = await Promise.all([
      this.businessFeaturesService.getEnabledKeys(businessId),
      this.platformFeatureFlagsService.getEnabledKeys(),
    ]);
    const globallyEnabled = new Set(globallyEnabledKeys);
    return businessEnabledKeys.filter((key) => globallyEnabled.has(key));
  }

  private hash(secret: string): string {
    return createHash('sha256').update(secret).digest('hex');
  }
}
