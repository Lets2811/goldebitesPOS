import { Injectable } from '@nestjs/common';
import { generateTemporaryPassword } from '../../../common/utils/generate-password.util';
import { EntityNotFoundException } from '../../../common/exceptions';
import { AuditService } from '../../../modules/audit/services/audit.service';
import { Business } from '../../../modules/businesses/domain/business.interface';
import { BusinessesService } from '../../../modules/businesses/services/businesses.service';
import { Branch } from '../../../modules/branches/domain/branch.interface';
import {
  CreateBranchData,
  UpdateBranchData,
} from '../../../modules/branches/domain/branch.types';
import { BranchesService } from '../../../modules/branches/services/branches.service';
import {
  BusinessFeaturesService,
  FeatureStatus,
} from '../../../modules/business-features/services/business-features.service';
import {
  PlatformFeatureFlagsService,
  PlatformFeatureFlagStatus,
} from '../../../modules/platform-feature-flags/services/platform-feature-flags.service';
import { RolesService } from '../../../modules/roles/services/roles.service';
import { UsersService } from '../../../modules/users/services/users.service';
import { CreatePlatformBusinessDto } from '../dto/create-platform-business.dto';

const DEFAULT_BRANCH_NAME = 'Sede Principal';
/** Far more branches than any business has; the list is shown whole. */
const MAX_BRANCHES_LISTED = 200;

export interface BusinessUserSummary {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  roleName: string;
  status: string;
}

@Injectable()
export class PlatformAdminService {
  constructor(
    private readonly businessesService: BusinessesService,
    private readonly branchesService: BranchesService,
    private readonly rolesService: RolesService,
    private readonly usersService: UsersService,
    private readonly businessFeaturesService: BusinessFeaturesService,
    private readonly platformFeatureFlagsService: PlatformFeatureFlagsService,
    private readonly auditService: AuditService,
  ) {}

  async listBusinesses(): Promise<Business[]> {
    return this.businessesService.findAll();
  }

  /**
   * Provisions a business end to end: business + default branch + system
   * roles (via BusinessesService.create) + a first OWNER user, so it's
   * immediately usable — not just a bare business row.
   */
  async createBusiness(
    dto: CreatePlatformBusinessDto,
    actorUserId: string,
  ): Promise<Business> {
    const business = await this.businessesService.create(
      {
        name: dto.name,
        currency: dto.currency,
        timezone: dto.timezone,
      },
      actorUserId,
    );

    const branch = await this.branchesService.create(
      { businessId: business.id, name: DEFAULT_BRANCH_NAME },
      actorUserId,
    );

    const roles = await this.rolesService.findAllForBusiness(business.id);
    const ownerRole = roles.find((role) => role.name === 'OWNER');
    if (!ownerRole) {
      throw new EntityNotFoundException('Role', 'OWNER');
    }

    await this.usersService.create(
      business.id,
      {
        firstName: dto.ownerFirstName,
        lastName: dto.ownerLastName,
        email: dto.ownerEmail,
        password: dto.ownerPassword,
        roleId: ownerRole.id,
        branchId: branch.id,
      },
      actorUserId,
    );

    return business;
  }

  async getBusinessUsers(businessId: string): Promise<BusinessUserSummary[]> {
    await this.businessesService.findById(businessId);
    const [{ data: users }, roles] = await Promise.all([
      this.usersService.findAll({ businessId, page: 1, limit: 200 }),
      this.rolesService.findAllForBusiness(businessId),
    ]);
    const roleNameById = new Map(roles.map((role) => [role.id, role.name]));

    return users.map((user) => ({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      roleName: roleNameById.get(user.roleId) ?? user.roleId,
      status: user.status,
    }));
  }

  /** Resets a tenant user's password to a new random one, returned once — for when a business's admin is locked out. */
  async resetUserPassword(
    businessId: string,
    userId: string,
    actorUserId: string,
  ): Promise<{ temporaryPassword: string }> {
    const user = await this.usersService.findOne(businessId, userId);
    const temporaryPassword = generateTemporaryPassword();
    await this.usersService.setPasswordHash(user.id, temporaryPassword, true);

    await this.auditService.record({
      businessId,
      userId: actorUserId,
      entityType: 'user',
      entityId: user.id,
      action: 'PLATFORM_RESET_CREDENTIALS',
    });

    return { temporaryPassword };
  }

  /** Every branch of a business, active or not. */
  async getBranches(businessId: string): Promise<Branch[]> {
    await this.businessesService.findById(businessId);
    const { data } = await this.branchesService.findAll({
      businessId,
      page: 1,
      limit: MAX_BRANCHES_LISTED,
    });
    return data;
  }

  async createBranch(
    businessId: string,
    data: Omit<CreateBranchData, 'businessId'>,
    actorUserId: string,
  ): Promise<Branch> {
    await this.businessesService.findById(businessId);
    return this.branchesService.create({ businessId, ...data }, actorUserId);
  }

  async updateBranch(
    businessId: string,
    branchId: string,
    data: UpdateBranchData,
    actorUserId: string,
  ): Promise<Branch> {
    return this.branchesService.update(businessId, branchId, data, actorUserId);
  }

  async setBranchStatus(
    businessId: string,
    branchId: string,
    isActive: boolean,
    actorUserId: string,
  ): Promise<Branch> {
    return this.branchesService.setActive(
      businessId,
      branchId,
      isActive,
      actorUserId,
    );
  }

  async deleteBranch(
    businessId: string,
    branchId: string,
    actorUserId: string,
  ): Promise<void> {
    await this.branchesService.remove(businessId, branchId, actorUserId);
  }

  async getFeatures(businessId: string): Promise<FeatureStatus[]> {
    await this.businessesService.findById(businessId);
    return this.businessFeaturesService.getEffectiveCatalog(businessId);
  }

  async setFeature(
    businessId: string,
    featureKey: string,
    enabled: boolean,
    actorUserId: string,
  ): Promise<void> {
    await this.businessesService.findById(businessId);
    await this.businessFeaturesService.setFeature(
      businessId,
      featureKey,
      enabled,
    );

    // entity_id is a UUID column — feature keys ("inventory.specializedQueries")
    // aren't UUIDs, so the key travels in newValues instead, not entityId.
    await this.auditService.record({
      businessId,
      userId: actorUserId,
      entityType: 'business_feature',
      action: enabled ? 'PLATFORM_ENABLE_FEATURE' : 'PLATFORM_DISABLE_FEATURE',
      newValues: { featureKey, enabled },
    });
  }

  /** Platform-wide catalog — applies to every business at once, independent of business_features. */
  async getFeatureFlags(): Promise<PlatformFeatureFlagStatus[]> {
    return this.platformFeatureFlagsService.getCatalog();
  }

  async setFeatureFlag(
    featureKey: string,
    enabled: boolean,
    actorUserId: string,
  ): Promise<void> {
    await this.platformFeatureFlagsService.setFlag(featureKey, enabled);

    // A genuinely global toggle: no business to attribute it to.
    await this.auditService.record({
      businessId: null,
      userId: actorUserId,
      entityType: 'platform_feature_flag',
      action: enabled
        ? 'PLATFORM_ENABLE_GLOBAL_FEATURE'
        : 'PLATFORM_DISABLE_GLOBAL_FEATURE',
      newValues: { featureKey, enabled },
    });
  }
}
