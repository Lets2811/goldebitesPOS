import {
  InventoryItem,
  InventoryItemRow,
} from '../domain/inventory-item.interface';

export class InventoryItemMapper {
  static toDomain(row: InventoryItemRow): InventoryItem {
    return {
      id: row.id,
      businessId: row.business_id,
      categoryId: row.category_id,
      name: row.name,
      sku: row.sku,
      unit: row.unit,
      minimumStock: parseFloat(row.minimum_stock),
      currentCost: parseFloat(row.current_cost),
      serialNumber: row.serial_number,
      brand: row.brand,
      model: row.model,
      branchId: row.branch_id,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
