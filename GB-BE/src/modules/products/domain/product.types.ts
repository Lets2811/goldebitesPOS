import { ProductOptionGroup } from '../../option-groups/domain/option-group.interface';

/** Where customers ordering on their own see the product: the regular menu, "Arma tu combo", or both. */

export enum ProductMenuAvailability {
  MENU = 'MENU',

  BUILDER = 'BUILDER',

  BOTH = 'BOTH',
}

export interface CreateProductData {
  businessId: string;

  categoryId?: string;

  name: string;

  description?: string;

  sku?: string;

  salePrice?: number;

  imageUrl?: string;

  trackInventory?: boolean;

  optionGroups?: ProductOptionGroup[];

  menuAvailability?: ProductMenuAvailability;
}

export interface UpdateProductData {
  categoryId?: string;

  name?: string;

  description?: string;

  sku?: string;

  salePrice?: number;

  imageUrl?: string;

  trackInventory?: boolean;

  /** Replaces the whole set when present. */

  optionGroups?: ProductOptionGroup[];

  menuAvailability?: ProductMenuAvailability;
}

export interface ProductQuery {
  businessId: string;

  page: number;

  limit: number;

  categoryId?: string;

  isActive?: boolean;

  isVisible?: boolean;

  search?: string;
}
