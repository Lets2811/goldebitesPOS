export interface CreateSupplierData {
  businessId: string;
  name: string;
  taxId?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  creditDays?: number;
}

export interface UpdateSupplierData {
  name?: string;
  taxId?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  creditDays?: number;
}

export interface SupplierQuery {
  businessId: string;
  page: number;
  limit: number;
  isActive?: boolean;
  search?: string;
}
