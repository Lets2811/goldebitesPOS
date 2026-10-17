export interface ProductCategory {
  id: string;
  businessId: string;
  name: string;
  description: string | null;
  displayOrder: number;
  /** Its place among the sections of "Arma tu combo" — separate from displayOrder (the regular menu). */
  builderDisplayOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductCategoryRow {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  display_order: number;
  builder_display_order: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}
