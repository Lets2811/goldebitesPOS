import { InventoryMovementType } from './inventory-movement.types';

export interface InventoryMovement {
  id: string;
  businessId: string;
  branchId: string;
  locationId: string | null;
  inventoryItemId: string;
  movementType: InventoryMovementType;
  quantity: number;
  unitCost: number | null;
  referenceType: string | null;
  referenceId: string | null;
  notes: string | null;
  createdBy: string | null;
  createdAt: Date;
}

export interface InventoryMovementRow {
  id: string;
  business_id: string;
  branch_id: string;
  location_id: string | null;
  inventory_item_id: string;
  movement_type: InventoryMovementType;
  quantity: string;
  unit_cost: string | null;
  reference_type: string | null;
  reference_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: Date;
}

export interface StockRow {
  business_id: string;
  branch_id: string;
  location_id: string | null;
  inventory_item_id: string;
  stock: string;
}

export interface StockLevel {
  businessId: string;
  branchId: string;
  locationId: string | null;
  inventoryItemId: string;
  stock: number;
}

export interface LowStockRow {
  inventory_item_id: string;
  name: string;
  unit: string;
  minimum_stock: string;
  current_stock: string;
  branch_id: string;
  branch_name: string;
}

/** An item below its minimum (each item is one branch's, measured by that branch's stock). */
export interface LowStockAlert {
  inventoryItemId: string;
  name: string;
  unit: string;
  minimumStock: number;
  currentStock: number;
  branchId: string;
  branchName: string;
}
