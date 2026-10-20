import { ProductOptionGroup } from '../../option-groups/domain/option-group.interface';
import { Product, ProductRow } from '../domain/product.interface';
import { productImagePublicUrl } from '../storage/product-image-storage.util';

export class ProductMapper {
  static toDomain(
    row: ProductRow,
    optionGroups: ProductOptionGroup[] = [],
  ): Product {
    return {
      id: row.id,
      businessId: row.business_id,
      categoryId: row.category_id,
      name: row.name,
      description: row.description,
      sku: row.sku,
      salePrice: parseFloat(row.sale_price),
      currentCost: parseFloat(row.current_cost),
      // An uploaded photo wins over a linked one.
      imageUrl:
        row.image_path && row.image_updated_at
          ? productImagePublicUrl(row.id, row.image_updated_at)
          : row.image_url,
      branchId: row.branch_id,
      isActive: row.is_active,
      isVisible: row.is_visible,
      trackInventory: row.track_inventory,
      optionGroups,
      menuAvailability: row.menu_availability,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
