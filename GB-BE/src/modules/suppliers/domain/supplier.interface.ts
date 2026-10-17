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
  /** Payment term the supplier gives, in days; proposes the due date of a purchase on credit. */
  creditDays: number | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SupplierRow {
  id: string;
  business_id: string;
  name: string;
  tax_id: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  credit_days: number | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}
