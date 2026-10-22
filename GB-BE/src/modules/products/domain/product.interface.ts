import { ProductOptionGroup } from '../../option-groups/domain/option-group.interface';
import { ProductMenuAvailability } from './product.types';

export interface Product {
  id: string;
  businessId: string;
  categoryId: string | null;
  name: string;
  description: string | null;
  sku: string | null;
  salePrice: number;
  currentCost: number;
  imageUrl: string | null;
  /** The branch it belongs to: each branch has its own catalog. */
  branchId: string;
  isActive: boolean;
  /** Independent of isActive — whether this product should appear on customer-facing surfaces like the public menu. */
  isVisible: boolean;
  trackInventory: boolean;
  /** The option groups the product offers ("Salsas", "Tamaño"...) and how many of each the customer may pick. */
  optionGroups: ProductOptionGroup[];
  /** Customer-facing menus only: the regular menu, "Arma tu combo", or both. */
  menuAvailability: ProductMenuAvailability;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductRow {
  id: string;
  business_id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  sku: string | null;
  sale_price: string;
  current_cost: string;
  image_url: string | null;
  /** An uploaded photo on disk; takes precedence over image_url. */
  image_path: string | null;
  image_mime_type: string | null;
  image_updated_at: Date | null;
  branch_id: string;
  is_active: boolean;
  is_visible: boolean;
  track_inventory: boolean;
  menu_availability: ProductMenuAvailability;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface ProductMargin {
  salePrice: number;
  currentCost: number;
  marginAmount: number;
  marginPercent: number;
}
