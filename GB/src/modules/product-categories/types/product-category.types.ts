export interface ProductCategory {
  id: string;
  businessId: string;
  name: string;
  description: string | null;
  displayOrder: number;
  /** Su lugar entre las secciones de "Arma tu combo"; aparte del orden del menú (displayOrder). */
  builderDisplayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductCategoryPayload {
  name: string;
  description?: string;
  displayOrder?: number;
}

export type UpdateProductCategoryPayload = Partial<CreateProductCategoryPayload>;

export interface ProductCategoryFilters {
  page?: number;
  limit?: number;
  isActive?: boolean;
  search?: string;
}

/** Qué lista ordena el cliente ve: el menú normal o "Arma tu combo". */
export type CategoryOrderScope = 'MENU' | 'BUILDER';
