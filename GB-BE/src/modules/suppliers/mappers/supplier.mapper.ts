import { Supplier, SupplierRow } from '../domain/supplier.interface';

export class SupplierMapper {
  static toDomain(row: SupplierRow): Supplier {
    return {
      id: row.id,
      businessId: row.business_id,
      name: row.name,
      taxId: row.tax_id,
      contactName: row.contact_name,
      email: row.email,
      phone: row.phone,
      address: row.address,
      notes: row.notes,
      creditDays: row.credit_days,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
