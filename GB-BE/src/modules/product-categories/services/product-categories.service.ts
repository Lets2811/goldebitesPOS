import { Inject, Injectable } from '@nestjs/common';
import {
  BusinessRuleException,
  ConflictException,
  EntityNotFoundException,
} from '../../../common/exceptions';
import { PaginatedResult } from '../../../common/pagination/paginated-result.interface';
import { buildPaginationMeta } from '../../../common/pagination/pagination.util';
import { AuditService } from '../../audit/services/audit.service';
import {
  ProductCategory,
  ProductCategoryRow,
} from '../domain/product-category.interface';
import {
  CategoryOrderScope,
  CreateProductCategoryData,
  ProductCategoryQuery,
  UpdateProductCategoryData,
} from '../domain/product-category.types';
import { ProductCategoryMapper } from '../mappers/product-category.mapper';
import { PRODUCT_CATEGORIES_REPOSITORY } from '../repositories/product-categories.repository.interface';
import type { IProductCategoriesRepository } from '../repositories/product-categories.repository.interface';

@Injectable()
export class ProductCategoriesService {
  constructor(
    @Inject(PRODUCT_CATEGORIES_REPOSITORY)
    private readonly categoriesRepository: IProductCategoriesRepository,
    private readonly auditService: AuditService,
  ) {}

  async create(
    data: CreateProductCategoryData,
    actorUserId?: string,
  ): Promise<ProductCategory> {
    const nameTaken = await this.categoriesRepository.existsByName(
      data.businessId,
      data.name,
    );
    if (nameTaken) {
      throw new ConflictException(
        `A category named "${data.name}" already exists`,
        'CATEGORY_NAME_TAKEN',
      );
    }

    const row = await this.categoriesRepository.create(data);
    await this.auditService.record({
      businessId: data.businessId,
      userId: actorUserId,
      entityType: 'product_category',
      entityId: row.id,
      action: 'CREATE',
      newValues: { name: row.name },
    });
    return ProductCategoryMapper.toDomain(row);
  }

  async findAll(
    query: ProductCategoryQuery,
  ): Promise<PaginatedResult<ProductCategory>> {
    const { rows, total } = await this.categoriesRepository.findAll(query);
    return {
      data: rows.map((row) => ProductCategoryMapper.toDomain(row)),
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  async findOne(businessId: string, id: string): Promise<ProductCategory> {
    const row = await this.getOwnedOrFail(businessId, id);
    return ProductCategoryMapper.toDomain(row);
  }

  async update(
    businessId: string,
    id: string,
    data: UpdateProductCategoryData,
    actorUserId?: string,
  ): Promise<ProductCategory> {
    await this.getOwnedOrFail(businessId, id);

    if (data.name) {
      const nameTaken = await this.categoriesRepository.existsByName(
        businessId,
        data.name,
        id,
      );
      if (nameTaken) {
        throw new ConflictException(
          `A category named "${data.name}" already exists`,
          'CATEGORY_NAME_TAKEN',
        );
      }
    }

    const row = await this.categoriesRepository.update(id, businessId, data);
    if (!row) {
      throw new EntityNotFoundException('ProductCategory', id);
    }
    await this.auditService.record({
      businessId,
      userId: actorUserId,
      entityType: 'product_category',
      entityId: id,
      action: 'UPDATE',
      newValues: data as Record<string, unknown>,
    });
    return ProductCategoryMapper.toDomain(row);
  }

  async setActive(
    businessId: string,
    id: string,
    isActive: boolean,
    actorUserId?: string,
  ): Promise<ProductCategory> {
    await this.getOwnedOrFail(businessId, id);
    const row = await this.categoriesRepository.setActive(
      id,
      businessId,
      isActive,
    );
    if (!row) {
      throw new EntityNotFoundException('ProductCategory', id);
    }
    await this.auditService.record({
      businessId,
      userId: actorUserId,
      entityType: 'product_category',
      entityId: id,
      action: isActive ? 'ACTIVATE' : 'DEACTIVATE',
    });
    return ProductCategoryMapper.toDomain(row);
  }

  private async getOwnedOrFail(
    businessId: string,
    id: string,
  ): Promise<ProductCategoryRow> {
    const row = await this.categoriesRepository.findById(id, businessId);
    if (!row) {
      throw new EntityNotFoundException('ProductCategory', id);
    }
    return row;
  }

  /**
   * The order of the sections customers see, in the regular menu or in
   * "Arma tu combo": `categoryIds` from first to last. Every id must be a
   * distinct category of this business; categories left out keep their place.
   */
  async setOrder(
    businessId: string,
    scope: CategoryOrderScope,
    categoryIds: string[],
    actorUserId?: string,
  ): Promise<void> {
    if (new Set(categoryIds).size !== categoryIds.length) {
      throw new BusinessRuleException('A category appears twice in the order', 'DUPLICATE_CATEGORY_IN_ORDER');
    }
    const owned = await this.categoriesRepository.countOwned(businessId, categoryIds);
    if (owned !== categoryIds.length) {
      throw new EntityNotFoundException('ProductCategory', 'one or more of the given ids');
    }
    await this.categoriesRepository.setOrder(businessId, scope, categoryIds);
    await this.auditService.record({
      businessId,
      userId: actorUserId,
      entityType: 'product_category',
      entityId: businessId,
      action: scope === CategoryOrderScope.BUILDER ? 'REORDER_BUILDER' : 'REORDER_MENU',
      newValues: { categoryIds },
    });
  }
}
