import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service';
import { getOffset } from '../../../common/pagination/pagination.util';
import { DbClient } from '../../../database/types/database.types';
import { ProductRow } from '../domain/product.interface';
import {
  CreateProductData,
  ProductQuery,
  UpdateProductData,
} from '../domain/product.types';
import { IProductsRepository } from './products.repository.interface';

const SELECT_COLUMNS = `id, business_id, category_id, name, description, sku, sale_price,
  current_cost, image_url, image_path, image_mime_type, image_updated_at, is_active, is_visible, track_inventory, menu_availability, created_at, updated_at, deleted_at`;

interface CountRow {
  count: string;
}

@Injectable()
export class ProductsRepository implements IProductsRepository {
  constructor(private readonly db: DatabaseService) {}

  async create(
    data: CreateProductData,
    client?: DbClient,
  ): Promise<ProductRow> {
    const result = await this.db.query<ProductRow>(
      `INSERT INTO products (business_id, category_id, name, description, sku, sale_price, image_url, track_inventory, menu_availability)
       VALUES ($1, $2, $3, $4, $5, COALESCE($6::numeric, 0), $7, COALESCE($8, true), COALESCE($9, 'MENU'))
       RETURNING ${SELECT_COLUMNS}`,
      [
        data.businessId,
        data.categoryId ?? null,
        data.name,
        data.description ?? null,
        data.sku ?? null,
        data.salePrice ?? null,
        data.imageUrl ?? null,
        data.trackInventory ?? null,
        data.menuAvailability ?? null,
      ],
      client,
    );
    return result.rows[0];
  }

  async findById(
    id: string,
    businessId: string,
    client?: DbClient,
  ): Promise<ProductRow | null> {
    const result = await this.db.query<ProductRow>(
      `SELECT ${SELECT_COLUMNS} FROM products
       WHERE id = $1 AND business_id = $2 AND deleted_at IS NULL`,
      [id, businessId],
      client,
    );
    return result.rows[0] ?? null;
  }

  async findAll(
    query: ProductQuery,
  ): Promise<{ rows: ProductRow[]; total: number }> {
    const conditions: string[] = ['business_id = $1', 'deleted_at IS NULL'];
    const params: unknown[] = [query.businessId];

    if (query.categoryId) {
      params.push(query.categoryId);
      conditions.push(`category_id = $${params.length}`);
    }

    if (query.isActive !== undefined) {
      params.push(query.isActive);
      conditions.push(`is_active = $${params.length}`);
    }

    if (query.isVisible !== undefined) {
      params.push(query.isVisible);
      conditions.push(`is_visible = $${params.length}`);
    }

    if (query.search) {
      params.push(`%${query.search}%`);
      const idx = params.length;
      conditions.push(`(name ILIKE $${idx} OR sku ILIKE $${idx})`);
    }

    const whereClause = conditions.join(' AND ');

    const countResult = await this.db.query<CountRow>(
      `SELECT COUNT(*)::text AS count FROM products WHERE ${whereClause}`,
      params,
    );
    const total = parseInt(countResult.rows[0]?.count ?? '0', 10);

    const dataParams = [
      ...params,
      query.limit,
      getOffset(query.page, query.limit),
    ];
    const rowsResult = await this.db.query<ProductRow>(
      `SELECT ${SELECT_COLUMNS}
       FROM products
       WHERE ${whereClause}
       ORDER BY name
       LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
      dataParams,
    );

    return { rows: rowsResult.rows, total };
  }

  async findAvailableForSale(businessId: string): Promise<ProductRow[]> {
    const result = await this.db.query<ProductRow>(
      `SELECT ${SELECT_COLUMNS} FROM products
       WHERE business_id = $1 AND is_active = true AND deleted_at IS NULL
       ORDER BY name`,
      [businessId],
    );
    return result.rows;
  }

  async update(
    id: string,
    businessId: string,
    data: UpdateProductData,
    client?: DbClient,
  ): Promise<ProductRow | null> {
    const result = await this.db.query<ProductRow>(
      `UPDATE products
       SET category_id = COALESCE($3, category_id),
           name = COALESCE($4, name),
           description = COALESCE($5, description),
           sku = COALESCE($6, sku),
           sale_price = COALESCE($7, sale_price),
           image_url = COALESCE($8, image_url),
           track_inventory = COALESCE($9, track_inventory),
           menu_availability = COALESCE($10, menu_availability)
       WHERE id = $1 AND business_id = $2 AND deleted_at IS NULL
       RETURNING ${SELECT_COLUMNS}`,
      [
        id,
        businessId,
        data.categoryId ?? null,
        data.name ?? null,
        data.description ?? null,
        data.sku ?? null,
        data.salePrice ?? null,
        data.imageUrl ?? null,
        data.trackInventory ?? null,
        data.menuAvailability ?? null,
      ],
      client,
    );
    return result.rows[0] ?? null;
  }

  async setActive(
    id: string,
    businessId: string,
    isActive: boolean,
  ): Promise<ProductRow | null> {
    const result = await this.db.query<ProductRow>(
      `UPDATE products SET is_active = $3
       WHERE id = $1 AND business_id = $2 AND deleted_at IS NULL
       RETURNING ${SELECT_COLUMNS}`,
      [id, businessId, isActive],
    );
    return result.rows[0] ?? null;
  }

  async setVisible(
    id: string,
    businessId: string,
    isVisible: boolean,
  ): Promise<ProductRow | null> {
    const result = await this.db.query<ProductRow>(
      `UPDATE products SET is_visible = $3
       WHERE id = $1 AND business_id = $2 AND deleted_at IS NULL
       RETURNING ${SELECT_COLUMNS}`,
      [id, businessId, isVisible],
    );
    return result.rows[0] ?? null;
  }

  async setCurrentCost(
    id: string,
    businessId: string,
    currentCost: number,
    client?: DbClient,
  ): Promise<void> {
    await this.db.query(
      `UPDATE products SET current_cost = $3
       WHERE id = $1 AND business_id = $2 AND deleted_at IS NULL`,
      [id, businessId, currentCost],
      client,
    );
  }

  async softDelete(id: string, businessId: string): Promise<ProductRow | null> {
    const result = await this.db.query<ProductRow>(
      `UPDATE products SET deleted_at = now()
       WHERE id = $1 AND business_id = $2 AND deleted_at IS NULL
       RETURNING ${SELECT_COLUMNS}`,
      [id, businessId],
    );
    return result.rows[0] ?? null;
  }

  async setImage(
    id: string,
    businessId: string,
    imagePath: string,
    mimeType: string,
  ): Promise<ProductRow | null> {
    const result = await this.db.query<ProductRow>(
      `UPDATE products
       SET image_path = $3, image_mime_type = $4, image_updated_at = now(), updated_at = now()
       WHERE id = $1 AND business_id = $2 AND deleted_at IS NULL
       RETURNING ${SELECT_COLUMNS}`,
      [id, businessId, imagePath, mimeType],
    );
    return result.rows[0] ?? null;
  }

  /** Removes the photo, uploaded or linked. */
  async clearImage(id: string, businessId: string): Promise<ProductRow | null> {
    const result = await this.db.query<ProductRow>(
      `UPDATE products
       SET image_path = NULL, image_mime_type = NULL, image_updated_at = NULL, image_url = NULL, updated_at = now()
       WHERE id = $1 AND business_id = $2 AND deleted_at IS NULL
       RETURNING ${SELECT_COLUMNS}`,
      [id, businessId],
    );
    return result.rows[0] ?? null;
  }

  async findImageFile(
    id: string,
  ): Promise<{ image_path: string; image_mime_type: string } | null> {
    const result = await this.db.query<{
      image_path: string;
      image_mime_type: string;
    }>(
      `SELECT image_path, image_mime_type FROM products
       WHERE id = $1 AND deleted_at IS NULL AND image_path IS NOT NULL`,
      [id],
    );
    return result.rows[0] ?? null;
  }

  async existsBySku(
    businessId: string,
    sku: string,
    excludeId?: string,
  ): Promise<boolean> {
    const result = await this.db.query<{ id: string }>(
      `SELECT id FROM products
       WHERE business_id = $1 AND sku = $2 AND deleted_at IS NULL
         AND ($3::uuid IS NULL OR id != $3)`,
      [businessId, sku, excludeId ?? null],
    );
    return result.rows.length > 0;
  }
}
