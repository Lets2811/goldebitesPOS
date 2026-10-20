export interface InventoryItem {
  id: string;
  businessId: string;
  categoryId: string | null;
  name: string;
  sku: string | null;
  unit: string;
  minimumStock: number;
  currentCost: number;
  serialNumber: string | null;
  brand: string | null;
  model: string | null;
  /** The branch it belongs to: each branch has its own list of items. */
  branchId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface InventoryItemRow {
  id: string;
  business_id: string;
  category_id: string | null;
  name: string;
  sku: string | null;
  unit: string;
  minimum_stock: string;
  current_cost: string;
  serial_number: string | null;
  brand: string | null;
  model: string | null;
  branch_id: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}
