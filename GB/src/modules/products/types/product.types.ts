import type { ProductOptionGroup } from '../../option-groups/types/option-group.types';

/** Dónde lo ve el cliente que pide solo (menú de la mesa): el menú normal, "Arma tu combo", o ambos. El POS de caja siempre ve todo. */
export type ProductMenuAvailability = 'MENU' | 'BUILDER' | 'BOTH';

export const PRODUCT_MENU_AVAILABILITY_LABELS: Record<ProductMenuAvailability, string> = {
  MENU: 'Solo menú',
  BUILDER: 'Solo arma tu combo',
  BOTH: 'Menú y arma tu combo',
};

/** Mirrors GB-BE's Product domain object (src/modules/products/domain/product.interface.ts). */
export interface Product {
  id: string;
  businessId: string;
  /** The branch it belongs to: each branch has its own catalog. */
  branchId: string;
  categoryId: string | null;
  name: string;
  description: string | null;
  sku: string | null;
  salePrice: number;
  currentCost: number;
  imageUrl: string | null;
  isActive: boolean;
  /** Independent of isActive — whether this product appears on customer-facing surfaces like the public menu. */
  isVisible: boolean;
  trackInventory: boolean;
  /** Los grupos de opciones que ofrece ("Salsas", "Tamaño"...) y cuántas de cada uno se eligen. */
  optionGroups: ProductOptionGroup[];
  menuAvailability: ProductMenuAvailability;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductPayload {
  name: string;
  categoryId?: string;
  description?: string;
  sku?: string;
  salePrice?: number;
  imageUrl?: string;
  trackInventory?: boolean;
  /** Reemplaza el conjunto completo. */
  optionGroups?: ProductOptionGroup[];
  menuAvailability?: ProductMenuAvailability;
}

export type UpdateProductPayload = Partial<CreateProductPayload>;

export interface ProductFilters {
  /** One branch's catalog; the hooks default it to the session's. */
  branchId?: string;
  page?: number;
  limit?: number;
  categoryId?: string;
  isActive?: boolean;
  isVisible?: boolean;
  search?: string;
}
