import { apiClient } from '../../../lib/api/api-client';
import type { ApiResponse, PaginatedResponse } from '../../../lib/api/api-types';
import type {
  CategoryOrderScope,
  CreateProductCategoryPayload,
  ProductCategory,
  ProductCategoryFilters,
  UpdateProductCategoryPayload,
} from '../types/product-category.types';

export const productCategoriesApi = {
  /** Las secciones de la primera a la última, en el menú o en "Arma tu combo". */
  async setOrder(scope: CategoryOrderScope, categoryIds: string[]): Promise<void> {
    await apiClient.put('/product-categories/order', { scope, categoryIds });
  },

  async getCategories(
    filters: ProductCategoryFilters = {},
  ): Promise<PaginatedResponse<ProductCategory>> {
    const { data } = await apiClient.get<PaginatedResponse<ProductCategory>>(
      '/product-categories',
      { params: filters },
    );
    return data;
  },

  async getCategory(id: string): Promise<ProductCategory> {
    const { data } = await apiClient.get<ApiResponse<ProductCategory>>(
      `/product-categories/${id}`,
    );
    return data.data;
  },

  async createCategory(payload: CreateProductCategoryPayload): Promise<ProductCategory> {
    const { data } = await apiClient.post<ApiResponse<ProductCategory>>(
      '/product-categories',
      payload,
    );
    return data.data;
  },

  async updateCategory(
    id: string,
    payload: UpdateProductCategoryPayload,
  ): Promise<ProductCategory> {
    const { data } = await apiClient.patch<ApiResponse<ProductCategory>>(
      `/product-categories/${id}`,
      payload,
    );
    return data.data;
  },

  async setCategoryStatus(id: string, isActive: boolean): Promise<ProductCategory> {
    const { data } = await apiClient.patch<ApiResponse<ProductCategory>>(
      `/product-categories/${id}/status`,
      { isActive },
    );
    return data.data;
  },
};
