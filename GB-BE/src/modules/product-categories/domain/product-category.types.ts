export interface CreateProductCategoryData {
  businessId: string;
  name: string;
  description?: string;
  displayOrder?: number;
}

export interface UpdateProductCategoryData {
  name?: string;
  description?: string;
  displayOrder?: number;
}

/** Which customer-facing list an ordering applies to: the regular menu or "Arma tu combo". */
export enum CategoryOrderScope {
  MENU = 'MENU',
  BUILDER = 'BUILDER',
}

export interface ProductCategoryQuery {
  businessId: string;
  page: number;
  limit: number;
  isActive?: boolean;
  search?: string;
}
