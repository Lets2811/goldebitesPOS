export interface InventoryItem {
  id: string;
  businessId: string;
  /** The branch it belongs to: each branch has its own items. */
  branchId: string;
  categoryId: string | null;
  name: string;
  sku: string | null;
  unit: string;
  minimumStock: number;
  currentCost: number;
  serialNumber: string | null;
  brand: string | null;
  model: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateInventoryItemPayload {
  categoryId?: string;
  name: string;
  sku?: string;
  unit: string;
  minimumStock?: number;
  currentCost?: number;
  serialNumber?: string;
  brand?: string;
  model?: string;
}

export type UpdateInventoryItemPayload = Partial<CreateInventoryItemPayload>;

export interface InventoryItemFilters {
  /** One branch's items; the hooks default it to the session's. */
  branchId?: string;
  page?: number;
  limit?: number;
  categoryId?: string;
  isActive?: boolean;
  search?: string;
}

export type InventoryMovementType =
  | 'PURCHASE'
  | 'SALE_CONSUMPTION'
  | 'WASTE'
  | 'ADJUSTMENT_IN'
  | 'ADJUSTMENT_OUT'
  | 'TRANSFER_IN'
  | 'TRANSFER_OUT'
  | 'RETURN'
  | 'INITIAL_STOCK';

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
  createdAt: string;
}

export interface MovementFilters {
  page?: number;
  limit?: number;
  branchId?: string;
  inventoryItemId?: string;
  movementType?: InventoryMovementType;
  dateFrom?: string;
  dateTo?: string;
}

export interface StockLevel {
  businessId: string;
  branchId: string;
  locationId: string | null;
  inventoryItemId: string;
  stock: number;
}

export interface StockFilters {
  branchId?: string;
  locationId?: string;
  inventoryItemId?: string;
}

export interface LowStockAlert {
  inventoryItemId: string;
  name: string;
  unit: string;
  minimumStock: number;
  currentStock: number;
  /** The branch the item is (each item is one branch's). */
  branchId: string;
  branchName: string;
}

export interface CreateAdjustmentPayload {
  branchId: string;
  locationId?: string;
  inventoryItemId: string;
  direction: 'IN' | 'OUT';
  quantity: number;
  reason: string;
}
