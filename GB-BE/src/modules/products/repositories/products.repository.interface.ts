import { DbClient } from '../../../database/types/database.types';
import { ProductRow } from '../domain/product.interface';
import {
  CreateProductData,
  ProductQuery,
  UpdateProductData,
} from '../domain/product.types';

export interface IProductsRepository {
  create(data: CreateProductData, client?: DbClient): Promise<ProductRow>;
  findById(
    id: string,
    businessId: string,
    client?: DbClient,
  ): Promise<ProductRow | null>;
  findAll(query: ProductQuery): Promise<{ rows: ProductRow[]; total: number }>;
  findAvailableForSale(businessId: string): Promise<ProductRow[]>;
  update(
    id: string,
    businessId: string,
    data: UpdateProductData,
    client?: DbClient,
  ): Promise<ProductRow | null>;
  setActive(
    id: string,
    businessId: string,
    isActive: boolean,
  ): Promise<ProductRow | null>;
  setVisible(
    id: string,
    businessId: string,
    isVisible: boolean,
  ): Promise<ProductRow | null>;
  setCurrentCost(
    id: string,
    businessId: string,
    currentCost: number,
    client?: DbClient,
  ): Promise<void>;
  softDelete(id: string, businessId: string): Promise<ProductRow | null>;
  setImage(
    id: string,
    businessId: string,
    imagePath: string,
    mimeType: string,
  ): Promise<ProductRow | null>;
  clearImage(id: string, businessId: string): Promise<ProductRow | null>;
  /** The uploaded photo of a product, for the public image endpoint (no business scope: ids aren't guessable). */
  findImageFile(
    id: string,
  ): Promise<{ image_path: string; image_mime_type: string } | null>;
  existsBySku(
    businessId: string,
    sku: string,
    excludeId?: string,
  ): Promise<boolean>;
}

export const PRODUCTS_REPOSITORY = Symbol('PRODUCTS_REPOSITORY');
