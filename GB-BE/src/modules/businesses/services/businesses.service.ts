import { Inject, Injectable } from '@nestjs/common';
import { EntityNotFoundException } from '../../../common/exceptions';
import { TransactionService } from '../../../database/transaction.service';
import { AuditService } from '../../audit/services/audit.service';
import { RolesService } from '../../roles/services/roles.service';
import { Business, BusinessRow } from '../domain/business.interface';
import {
  CreateBusinessData,
  UpdateBusinessData,
} from '../domain/business.types';
import { BusinessMapper } from '../mappers/business.mapper';
import { BUSINESSES_REPOSITORY } from '../repositories/businesses.repository.interface';
import type { IBusinessesRepository } from '../repositories/businesses.repository.interface';
import { deleteBusinessLogoFile } from '../storage/business-logo-storage.util';

@Injectable()
export class BusinessesService {
  constructor(
    @Inject(BUSINESSES_REPOSITORY)
    private readonly businessesRepository: IBusinessesRepository,
    private readonly rolesService: RolesService,
    private readonly transactionService: TransactionService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Creates a new business and provisions its default role catalog in the
   * same transaction, so a business is never left without any role to
   * assign to its first user.
   */
  async create(
    data: CreateBusinessData,
    actorUserId?: string,
  ): Promise<Business> {
    const row = await this.transactionService.execute(async (client) => {
      const business = await this.businessesRepository.create(data, client);
      await this.rolesService.provisionSystemRoles(business.id, client);
      await this.auditService.record(
        {
          businessId: business.id,
          userId: actorUserId,
          entityType: 'business',
          entityId: business.id,
          action: 'CREATE',
          newValues: { name: business.name },
        },
        client,
      );
      return business;
    });

    return BusinessMapper.toDomain(row);
  }

  async findAll(): Promise<Business[]> {
    const rows = await this.businessesRepository.findAll();
    return rows.map((row) => BusinessMapper.toDomain(row));
  }

  async findById(id: string): Promise<Business> {
    const row = await this.getOrFail(id);
    return BusinessMapper.toDomain(row);
  }

  async update(
    id: string,
    data: UpdateBusinessData,
    actorUserId?: string,
  ): Promise<Business> {
    await this.getOrFail(id);
    const row = await this.businessesRepository.update(id, data);
    if (!row) {
      throw new EntityNotFoundException('Business', id);
    }
    await this.auditService.record({
      businessId: id,
      userId: actorUserId,
      entityType: 'business',
      entityId: id,
      action: 'UPDATE',
      newValues: data as Record<string, unknown>,
    });
    return BusinessMapper.toDomain(row);
  }

  async setActive(
    id: string,
    isActive: boolean,
    actorUserId?: string,
  ): Promise<Business> {
    await this.getOrFail(id);
    const row = await this.businessesRepository.setActive(id, isActive);
    if (!row) {
      throw new EntityNotFoundException('Business', id);
    }
    await this.auditService.record({
      businessId: id,
      userId: actorUserId,
      entityType: 'business',
      entityId: id,
      action: isActive ? 'ACTIVATE' : 'DEACTIVATE',
    });
    return BusinessMapper.toDomain(row);
  }

  /** Used by PurchasesModule/OrdersModule to compute tax on the fly. */
  async getTaxRate(businessId: string): Promise<number> {
    const row = await this.getOrFail(businessId);
    return parseFloat(row.tax_rate);
  }

  /** Used by OrdersModule to compute the business-local calendar day for daily order numbers. */
  async getTimezone(businessId: string): Promise<string> {
    const row = await this.getOrFail(businessId);
    return row.timezone;
  }

  async updateTaxRate(
    id: string,
    taxRate: number,
    actorUserId?: string,
  ): Promise<Business> {
    await this.getOrFail(id);
    const row = await this.businessesRepository.updateTaxRate(id, taxRate);
    if (!row) {
      throw new EntityNotFoundException('Business', id);
    }
    await this.auditService.record({
      businessId: id,
      userId: actorUserId,
      entityType: 'business',
      entityId: id,
      action: 'UPDATE_TAX_RATE',
      newValues: { taxRate },
    });
    return BusinessMapper.toDomain(row);
  }

  /** Used by OrdersModule: whether the checkout may apply discounts. */
  async getDiscountsAtCheckout(businessId: string): Promise<boolean> {
    const row = await this.getOrFail(businessId);
    return row.discounts_at_checkout;
  }

  async updateDiscountsAtCheckout(
    id: string,
    enabled: boolean,
    actorUserId?: string,
  ): Promise<Business> {
    await this.getOrFail(id);
    const row = await this.businessesRepository.updateDiscountsAtCheckout(
      id,
      enabled,
    );
    if (!row) {
      throw new EntityNotFoundException('Business', id);
    }
    await this.auditService.record({
      businessId: id,
      userId: actorUserId,
      entityType: 'business',
      entityId: id,
      action: 'UPDATE_DISCOUNTS_AT_CHECKOUT',
      newValues: { discountsAtCheckout: enabled },
    });
    return BusinessMapper.toDomain(row);
  }

  /** Used by LoyaltyModule to compute earned points and read program settings. */
  async getLoyaltyConfig(businessId: string): Promise<{
    pointsPerThousand: number;
    birthdayBonusEnabled: boolean;
    birthdayBonusPoints: number;
  }> {
    const row = await this.getOrFail(businessId);
    return {
      pointsPerThousand: parseFloat(row.loyalty_points_per_thousand),
      birthdayBonusEnabled: row.loyalty_birthday_bonus_enabled,
      birthdayBonusPoints: row.loyalty_birthday_bonus_points,
    };
  }

  async updateLoyaltyConfig(
    id: string,
    data: {
      pointsPerThousand?: number;
      birthdayBonusEnabled?: boolean;
      birthdayBonusPoints?: number;
    },
    actorUserId?: string,
  ): Promise<Business> {
    await this.getOrFail(id);
    const row = await this.businessesRepository.updateLoyaltyConfig(id, data);
    if (!row) {
      throw new EntityNotFoundException('Business', id);
    }
    await this.auditService.record({
      businessId: id,
      userId: actorUserId,
      entityType: 'business',
      entityId: id,
      action: 'UPDATE_LOYALTY_CONFIG',
      newValues: data,
    });
    return BusinessMapper.toDomain(row);
  }

  async setLogo(
    id: string,
    logoPath: string,
    mimeType: string,
    actorUserId?: string,
  ): Promise<void> {
    await this.getOrFail(id);
    const existing = await this.businessesRepository.getLogo(id);
    await this.businessesRepository.setLogo(id, logoPath, mimeType);
    if (existing) {
      deleteBusinessLogoFile(existing.logo_path);
    }
    await this.auditService.record({
      businessId: id,
      userId: actorUserId,
      entityType: 'business',
      entityId: id,
      action: 'UPDATE_LOGO',
    });
  }

  /** Used by BusinessesController to stream the logo file, and by print flows to embed it. */
  async getLogo(
    id: string,
  ): Promise<{ logoPath: string; mimeType: string } | null> {
    const row = await this.businessesRepository.getLogo(id);
    return row
      ? { logoPath: row.logo_path, mimeType: row.logo_mime_type }
      : null;
  }

  async clearLogo(id: string, actorUserId?: string): Promise<void> {
    await this.getOrFail(id);
    const existing = await this.businessesRepository.getLogo(id);
    if (!existing) {
      return;
    }
    await this.businessesRepository.clearLogo(id);
    deleteBusinessLogoFile(existing.logo_path);
    await this.auditService.record({
      businessId: id,
      userId: actorUserId,
      entityType: 'business',
      entityId: id,
      action: 'REMOVE_LOGO',
    });
  }

  private async getOrFail(id: string): Promise<BusinessRow> {
    const row = await this.businessesRepository.findById(id);
    if (!row) {
      throw new EntityNotFoundException('Business', id);
    }
    return row;
  }
}
