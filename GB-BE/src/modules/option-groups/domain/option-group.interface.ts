/**
 * What a customer can choose on a product, in groups each business defines:
 * Golden Bites has "Salsas" and "Acompañantes"; a bar may have "Mezcladores",
 * "Tamaño" and "Hielo", or none at all.
 */
export interface OptionItem {
  id: string;
  groupId: string;
  name: string;
  description: string | null;
  displayOrder: number;
  isActive: boolean;
}

export interface OptionGroup {
  id: string;
  businessId: string;
  /** Plural, as it reads above the choices: "Salsas". */
  name: string;
  /** "Salsa": for phrases like "Nueva salsa". */
  singularName: string;
  isActive: boolean;
  /** The customer must pick at least one wherever a product offers the group. */
  isRequired: boolean;
  /** The max suggested when a product starts offering the group. */
  defaultMax: number;
  displayOrder: number;
  /** How many products offer the group: what deleting it would take away. */
  productCount: number;
  /** Every option of the group, active or not, in display order. */
  items: OptionItem[];
}

/** One group a product offers, and how many of it the customer may pick. */
export interface ProductOptionGroup {
  groupId: string;
  maxChoices: number;
}

/** What was chosen in one group on an order item, with the names as they were that day. */
export interface OptionSelection {
  groupId: string;
  groupName: string;
  itemIds: string[];
  itemNames: string[];
}

export interface OptionGroupRow {
  id: string;
  business_id: string;
  name: string;
  singular_name: string;
  is_active: boolean;
  is_required: boolean;
  default_max: number;
  display_order: number;
  created_at: Date;
  updated_at: Date;
  /** Only from findGroups (a COUNT, so pg returns it as text). */
  product_count?: string;
}

export interface OptionItemRow {
  id: string;
  business_id: string;
  group_id: string;
  name: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface ProductOptionGroupRow {
  product_id: string;
  group_id: string;
  max_choices: number;
}

export interface CreateOptionGroupData {
  businessId: string;
  name: string;
  singularName: string;
  isRequired?: boolean;
  defaultMax?: number;
}

export interface UpdateOptionGroupData {
  name?: string;
  singularName?: string;
  isActive?: boolean;
  isRequired?: boolean;
  defaultMax?: number;
}

export interface CreateOptionItemData {
  businessId: string;
  groupId: string;
  name: string;
  description?: string;
  displayOrder?: number;
}

export interface UpdateOptionItemData {
  name?: string;
  description?: string;
  displayOrder?: number;
  isActive?: boolean;
}
