export interface Supplier {
  id: string;
  businessId: string;
  name: string;
  taxId: string | null;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  /** Plazo que da el proveedor, en días: propone el vencimiento de las compras a crédito. */
  creditDays: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSupplierPayload {
  name: string;
  taxId?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  creditDays?: number;
}

export type UpdateSupplierPayload = Partial<CreateSupplierPayload>;

export interface SupplierFilters {
  page?: number;
  limit?: number;
  isActive?: boolean;
  search?: string;
}
