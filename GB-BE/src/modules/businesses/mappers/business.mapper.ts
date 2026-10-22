import { Business, BusinessRow } from '../domain/business.interface';

export class BusinessMapper {
  static toDomain(row: BusinessRow): Business {
    return {
      id: row.id,
      name: row.name,
      legalName: row.legal_name,
      taxId: row.tax_id,
      email: row.email,
      phone: row.phone,
      currency: row.currency,
      timezone: row.timezone,
      taxRate: parseFloat(row.tax_rate),
      discountsAtCheckout: row.discounts_at_checkout,
      menuTopSellers: row.menu_top_sellers,
      comboBuilderName: row.combo_builder_name,
      comboBuilderDescription: row.combo_builder_description,
      hasComboBuilderTemplate: row.has_combo_builder_template,
      loyaltyPointsPerThousand: parseFloat(row.loyalty_points_per_thousand),
      loyaltyBirthdayBonusEnabled: row.loyalty_birthday_bonus_enabled,
      loyaltyBirthdayBonusPoints: row.loyalty_birthday_bonus_points,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
