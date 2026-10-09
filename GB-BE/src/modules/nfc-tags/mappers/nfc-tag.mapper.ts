import { NfcTag, NfcTagRow } from '../domain/nfc-tag.interface';

export class NfcTagMapper {
  static toDomain(row: NfcTagRow): NfcTag {
    return {
      id: row.id,
      businessId: row.business_id,
      branchId: row.branch_id,
      tableNumber: row.table_number,
      name: row.name,
      token: row.token,
      isActive: row.is_active,
      selfServiceEnabled: row.self_service_enabled,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
