import { DbClient } from '../../../database/types/database.types';
import { ProductCategoryRow } from '../domain/product-category.interface';
import {
  CreateProductCategoryData,
  ProductCategoryQuery,
  UpdateProductCategoryData,
  CategoryOrderScope,
} from '../domain/product-category.types';

export interface IProductCategoriesRepository {
  create(
    data: CreateProductCategoryData,
    client?: DbClient,
  ): Promise<ProductCategoryRow>;
  findById(
    id: string,
    businessId: string,
    client?: DbClient,
  ): Promise<ProductCategoryRow | null>;
  findAll(
    query: ProductCategoryQuery,
  ): Promise<{ rows: ProductCategoryRow[]; total: number }>;
  update(
    id: string,
    businessId: string,
    data: UpdateProductCategoryData,
    client?: DbClient,
  ): Promise<ProductCategoryRow | null>;
  setActive(
    id: string,
    businessId: string,
    isActive: boolean,
  ): Promise<ProductCategoryRow | null>;
  existsByName(
    businessId: string,
    name: string,
    excludeId?: string,
  ): Promise<boolean>;
  countOwned(businessId: string, ids: string[]): Promise<number>;
  setOrder(businessId: string, scope: CategoryOrderScope, ids: string[]): Promise<void>;
}

export const PRODUCT_CATEGORIES_REPOSITORY = Symbol(
  'PRODUCT_CATEGORIES_REPOSITORY',
);
