export interface Business {
  id: string;
  name: string;
  legalName: string | null;
  taxId: string | null;
  email: string | null;
  phone: string | null;
  currency: string;
  timezone: string;
  taxRate: number;
  /** Whether the checkout offers the "Descuento" section. */
  discountsAtCheckout: boolean;
  /** "Arma tu combo" under the business's own name; null: the default. */
  comboBuilderName: string | null;
  /** The line under it; null: the default. */
  comboBuilderDescription: string | null;
  loyaltyPointsPerThousand: number;
  loyaltyBirthdayBonusEnabled: boolean;
  loyaltyBirthdayBonusPoints: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface BusinessRow {
  id: string;
  name: string;
  legal_name: string | null;
  tax_id: string | null;
  email: string | null;
  phone: string | null;
  currency: string;
  timezone: string;
  tax_rate: string;
  discounts_at_checkout: boolean;
  combo_builder_name: string | null;
  combo_builder_description: string | null;
  loyalty_points_per_thousand: string;
  loyalty_birthday_bonus_enabled: boolean;
  loyalty_birthday_bonus_points: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface BusinessLogoRow {
  logo_path: string;
  logo_mime_type: string;
}
