import { Inject, Injectable } from '@nestjs/common';
import {
  ConflictException,
  EntityNotFoundException,
} from '../../../common/exceptions';
import { DbClient } from '../../../database/types/database.types';
import { PaginatedResult } from '../../../common/pagination/paginated-result.interface';
import { buildPaginationMeta } from '../../../common/pagination/pagination.util';
import { AuditService } from '../../audit/services/audit.service';
import { ProductCategoriesService } from '../../product-categories/services/product-categories.service';
import { OptionGroupsService } from '../../option-groups/services/option-groups.service';
import {
  Product,
  ProductMargin,
  ProductRow,
} from '../domain/product.interface';
import {
  CreateProductData,
  ProductQuery,
  UpdateProductData,
} from '../domain/product.types';
import { ProductMapper } from '../mappers/product.mapper';
import { deleteProductImageFile } from '../storage/product-image-storage.util';
import { PRODUCTS_REPOSITORY } from '../repositories/products.repository.interface';
import type { IProductsRepository } from '../repositories/products.repository.interface';

@Injectable()
export class ProductsService {
  constructor(
    @Inject(PRODUCTS_REPOSITORY)
    private readonly productsRepository: IProductsRepository,
    private readonly categoriesService: ProductCategoriesService,
    private readonly auditService: AuditService,
    private readonly optionGroupsService: OptionGroupsService,
  ) {}

  async create(
    data: CreateProductData,
    actorUserId?: string,
  ): Promise<Product> {
    if (data.categoryId) {
      await this.categoriesService.findOne(data.businessId, data.categoryId);
    }
    if (data.sku) {
      await this.assertSkuFree(data.businessId, data.sku);
    }

    if (data.optionGroups) {
      await this.optionGroupsService.assertProductGroupsValid(
        data.businessId,
        data.optionGroups,
      );
    }

    const row = await this.productsRepository.create(data);
    if (data.optionGroups) {
      await this.optionGroupsService.setProductGroups(
        row.id,
        data.optionGroups,
      );
    }
    await this.auditService.record({
      businessId: data.businessId,
      userId: actorUserId,
      entityType: 'product',
      entityId: row.id,
      action: 'CREATE',
      newValues: { name: row.name, sku: row.sku },
    });
    return this.toDomain(row);
  }

  async findAll(query: ProductQuery): Promise<PaginatedResult<Product>> {
    const { rows, total } = await this.productsRepository.findAll(query);
    return {
      data: await this.toDomainList(rows),
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  async findAvailableForSale(businessId: string): Promise<Product[]> {
    const rows = await this.productsRepository.findAvailableForSale(businessId);
    return this.toDomainList(rows);
  }

  async findOne(businessId: string, id: string): Promise<Product> {
    const row = await this.getOwnedOrFail(businessId, id);
    return this.toDomain(row);
  }

  async getMargin(businessId: string, id: string): Promise<ProductMargin> {
    const row = await this.getOwnedOrFail(businessId, id);
    const salePrice = parseFloat(row.sale_price);
    const currentCost = parseFloat(row.current_cost);
    const marginAmount = round2(salePrice - currentCost);
    const marginPercent =
      salePrice > 0 ? round2((marginAmount / salePrice) * 100) : 0;
    return { salePrice, currentCost, marginAmount, marginPercent };
  }

  async update(
    businessId: string,
    id: string,
    data: UpdateProductData,
    actorUserId?: string,
  ): Promise<Product> {
    await this.getOwnedOrFail(businessId, id);

    if (data.categoryId) {
      await this.categoriesService.findOne(businessId, data.categoryId);
    }
    if (data.sku) {
      await this.assertSkuFree(businessId, data.sku, id);
    }
    if (data.optionGroups) {
      await this.optionGroupsService.assertProductGroupsValid(
        businessId,
        data.optionGroups,
      );
    }

    const row = await this.productsRepository.update(id, businessId, data);
    if (!row) {
      throw new EntityNotFoundException('Product', id);
    }
    if (data.optionGroups) {
      await this.optionGroupsService.setProductGroups(id, data.optionGroups);
    }
    await this.auditService.record({
      businessId,
      userId: actorUserId,
      entityType: 'product',
      entityId: id,
      action: 'UPDATE',
      newValues: data as Record<string, unknown>,
    });
    return this.toDomain(row);
  }

  async setActive(
    businessId: string,
    id: string,
    isActive: boolean,
    actorUserId?: string,
  ): Promise<Product> {
    await this.getOwnedOrFail(businessId, id);
    const row = await this.productsRepository.setActive(
      id,
      businessId,
      isActive,
    );
    if (!row) {
      throw new EntityNotFoundException('Product', id);
    }
    await this.auditService.record({
      businessId,
      userId: actorUserId,
      entityType: 'product',
      entityId: id,
      action: isActive ? 'ACTIVATE' : 'DEACTIVATE',
    });
    return this.toDomain(row);
  }

  /** Independent of setActive — whether this product shows up on customer-facing surfaces like the public menu. */
  async setVisible(
    businessId: string,
    id: string,
    isVisible: boolean,
    actorUserId?: string,
  ): Promise<Product> {
    await this.getOwnedOrFail(businessId, id);
    const row = await this.productsRepository.setVisible(
      id,
      businessId,
      isVisible,
    );
    if (!row) {
      throw new EntityNotFoundException('Product', id);
    }
    await this.auditService.record({
      businessId,
      userId: actorUserId,
      entityType: 'product',
      entityId: id,
      action: isVisible ? 'SHOW' : 'HIDE',
    });
    return this.toDomain(row);
  }

  async softDelete(
    businessId: string,
    id: string,
    actorUserId?: string,
  ): Promise<void> {
    const row = await this.productsRepository.softDelete(id, businessId);
    if (!row) {
      throw new EntityNotFoundException('Product', id);
    }
    await this.auditService.record({
      businessId,
      userId: actorUserId,
      entityType: 'product',
      entityId: id,
      action: 'DELETE',
    });
  }

  /** Saves an uploaded photo (already on disk) as the product's, replacing any previous one. */
  async setImage(
    businessId: string,
    id: string,
    imagePath: string,
    mimeType: string,
    actorUserId?: string,
  ): Promise<Product> {
    const before = await this.productsRepository.findById(id, businessId);
    if (!before) {
      deleteProductImageFile(imagePath);
      throw new EntityNotFoundException('Product', id);
    }
    const row = await this.productsRepository.setImage(
      id,
      businessId,
      imagePath,
      mimeType,
    );
    if (!row) {
      deleteProductImageFile(imagePath);
      throw new EntityNotFoundException('Product', id);
    }
    if (before.image_path) deleteProductImageFile(before.image_path);
    await this.auditService.record({
      businessId,
      userId: actorUserId,
      entityType: 'product',
      entityId: id,
      action: 'UPDATE_IMAGE',
    });
    return this.toDomain(row);
  }

  async clearImage(
    businessId: string,
    id: string,
    actorUserId?: string,
  ): Promise<Product> {
    const before = await this.getOwnedOrFail(businessId, id);
    const row = await this.productsRepository.clearImage(id, businessId);
    if (!row) {
      throw new EntityNotFoundException('Product', id);
    }
    if (before.image_path) deleteProductImageFile(before.image_path);
    await this.auditService.record({
      businessId,
      userId: actorUserId,
      entityType: 'product',
      entityId: id,
      action: 'REMOVE_IMAGE',
    });
    return this.toDomain(row);
  }

  /** For the public image endpoint: the photo file of a product, if it has one. */
  async getImageFile(
    id: string,
  ): Promise<{ path: string; mimeType: string } | null> {
    const file = await this.productsRepository.findImageFile(id);
    return file
      ? { path: file.image_path, mimeType: file.image_mime_type }
      : null;
  }

  /** Used by RecipesService: syncs the product's current_cost to its recipe cost. */
  async syncCostFromRecipe(
    businessId: string,
    productId: string,
    currentCost: number,
    client?: DbClient,
  ): Promise<void> {
    await this.productsRepository.setCurrentCost(
      productId,
      businessId,
      round2(currentCost),
      client,
    );
  }

  /** Used by RecipesService to validate product ownership before attaching a recipe. */
  async getOwnedOrFail(businessId: string, id: string): Promise<ProductRow> {
    const row = await this.productsRepository.findById(id, businessId);
    if (!row) {
      throw new EntityNotFoundException('Product', id);
    }
    return row;
  }

  private async toDomain(row: ProductRow): Promise<Product> {
    return (await this.toDomainList([row]))[0];
  }

  /** Rows to products, each with the option groups it offers (one query for the whole list). */
  private async toDomainList(rows: ProductRow[]): Promise<Product[]> {
    const groups = await this.optionGroupsService.getProductGroups(
      rows.map((row) => row.id),
    );
    return rows.map((row) => ProductMapper.toDomain(row, groups.get(row.id)));
  }

  private async assertSkuFree(
    businessId: string,
    sku: string,
    excludeId?: string,
  ): Promise<void> {
    const taken = await this.productsRepository.existsBySku(
      businessId,
      sku,
      excludeId,
    );
    if (taken) {
      throw new ConflictException(
        `SKU "${sku}" is already in use`,
        'PRODUCT_SKU_TAKEN',
      );
    }
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
