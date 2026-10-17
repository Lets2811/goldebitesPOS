import {
  ProductCategory,
  ProductCategoryRow,
} from '../domain/product-category.interface';

export class ProductCategoryMapper {
  static toDomain(row: ProductCategoryRow): ProductCategory {
    return {
      id: row.id,
      businessId: row.business_id,
      name: row.name,
      description: row.description,
      displayOrder: row.display_order,
      builderDisplayOrder: row.builder_display_order,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
