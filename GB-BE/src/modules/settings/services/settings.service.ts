import { Injectable } from '@nestjs/common';
import { BusinessesService } from '../../businesses/services/businesses.service';
import type { Business } from '../../businesses/domain/business.interface';

export interface BusinessSettings {
  taxRate: number;
  discountsAtCheckout: boolean;
}

export interface BusinessSettingsUpdate {
  taxRate?: number;
  discountsAtCheckout?: boolean;
}

const toSettings = (business: Business): BusinessSettings => ({
  taxRate: business.taxRate,
  discountsAtCheckout: business.discountsAtCheckout,
});

@Injectable()
export class SettingsService {
  constructor(private readonly businessesService: BusinessesService) {}

  async get(businessId: string): Promise<BusinessSettings> {
    return toSettings(await this.businessesService.findById(businessId));
  }

  /** Changes only what comes in; each setting keeps its own audit entry. */
  async update(
    businessId: string,
    changes: BusinessSettingsUpdate,
    actorUserId?: string,
  ): Promise<BusinessSettings> {
    if (changes.taxRate !== undefined) {
      await this.businessesService.updateTaxRate(
        businessId,
        changes.taxRate,
        actorUserId,
      );
    }
    if (changes.discountsAtCheckout !== undefined) {
      await this.businessesService.updateDiscountsAtCheckout(
        businessId,
        changes.discountsAtCheckout,
        actorUserId,
      );
    }
    return this.get(businessId);
  }
}
