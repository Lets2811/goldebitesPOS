import {
  InventoryMovement,
  InventoryMovementRow,
  LowStockAlert,
  LowStockRow,
  StockLevel,
  StockRow,
} from '../domain/inventory-movement.interface';

export class InventoryMovementMapper {
  static toDomain(row: InventoryMovementRow): InventoryMovement {
    return {
      id: row.id,
      businessId: row.business_id,
      branchId: row.branch_id,
      locationId: row.location_id,
      inventoryItemId: row.inventory_item_id,
      movementType: row.movement_type,
      quantity: parseFloat(row.quantity),
      unitCost: row.unit_cost === null ? null : parseFloat(row.unit_cost),
      referenceType: row.reference_type,
      referenceId: row.reference_id,
      notes: row.notes,
      createdBy: row.created_by,
      createdAt: row.created_at,
    };
  }

  static stockToDomain(row: StockRow): StockLevel {
    return {
      businessId: row.business_id,
      branchId: row.branch_id,
      locationId: row.location_id,
      inventoryItemId: row.inventory_item_id,
      stock: parseFloat(row.stock),
    };
  }

  static lowStockToDomain(row: LowStockRow): LowStockAlert {
    return {
      inventoryItemId: row.inventory_item_id,
      name: row.name,
      unit: row.unit,
      minimumStock: parseFloat(row.minimum_stock),
      currentStock: parseFloat(row.current_stock),
      branchId: row.branch_id,
      branchName: row.branch_name,
    };
  }
}
