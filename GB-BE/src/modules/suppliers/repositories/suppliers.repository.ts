import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service';
import { getOffset } from '../../../common/pagination/pagination.util';
import { DbClient } from '../../../database/types/database.types';
import { SupplierRow } from '../domain/supplier.interface';
import {
  CreateSupplierData,
  SupplierQuery,
  UpdateSupplierData,
} from '../domain/supplier.types';
import { ISuppliersRepository } from './suppliers.repository.interface';

const SELECT_COLUMNS = `id, business_id, name, tax_id, contact_name, email, phone, address, notes, credit_days, is_active, created_at, updated_at`;

interface CountRow {
  count: string;
}

@Injectable()
export class SuppliersRepository implements ISuppliersRepository {
  constructor(private readonly db: DatabaseService) {}

  async create(
    data: CreateSupplierData,
    client?: DbClient,
  ): Promise<SupplierRow> {
    const result = await this.db.query<SupplierRow>(
      `INSERT INTO suppliers (business_id, name, tax_id, contact_name, email, phone, address, notes, credit_days)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING ${SELECT_COLUMNS}`,
      [
        data.businessId,
        data.name,
        data.taxId ?? null,
        data.contactName ?? null,
        data.email ?? null,
        data.phone ?? null,
        data.address ?? null,
        data.notes ?? null,
        data.creditDays ?? null,
      ],
      client,
    );
    return result.rows[0];
  }

  async findById(
    id: string,
    businessId: string,
    client?: DbClient,
  ): Promise<SupplierRow | null> {
    const result = await this.db.query<SupplierRow>(
      `SELECT ${SELECT_COLUMNS} FROM suppliers WHERE id = $1 AND business_id = $2`,
      [id, businessId],
      client,
    );
    return result.rows[0] ?? null;
  }

  async findAll(
    query: SupplierQuery,
  ): Promise<{ rows: SupplierRow[]; total: number }> {
    const conditions: string[] = ['business_id = $1'];
    const params: unknown[] = [query.businessId];

    if (query.isActive !== undefined) {
      params.push(query.isActive);
      conditions.push(`is_active = $${params.length}`);
    }

    if (query.search) {
      params.push(`%${query.search}%`);
      const idx = params.length;
      conditions.push(
        `(name ILIKE $${idx} OR tax_id ILIKE $${idx} OR contact_name ILIKE $${idx})`,
      );
    }

    const whereClause = conditions.join(' AND ');

    const countResult = await this.db.query<CountRow>(
      `SELECT COUNT(*)::text AS count FROM suppliers WHERE ${whereClause}`,
      params,
    );
    const total = parseInt(countResult.rows[0]?.count ?? '0', 10);

    const dataParams = [
      ...params,
      query.limit,
      getOffset(query.page, query.limit),
    ];
    const rowsResult = await this.db.query<SupplierRow>(
      `SELECT ${SELECT_COLUMNS}
       FROM suppliers
       WHERE ${whereClause}
       ORDER BY name
       LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
      dataParams,
    );

    return { rows: rowsResult.rows, total };
  }

  async update(
    id: string,
    businessId: string,
    data: UpdateSupplierData,
    client?: DbClient,
  ): Promise<SupplierRow | null> {
    const result = await this.db.query<SupplierRow>(
      `UPDATE suppliers
       SET name = COALESCE($3, name),
           tax_id = COALESCE($4, tax_id),
           contact_name = COALESCE($5, contact_name),
           email = COALESCE($6, email),
           phone = COALESCE($7, phone),
           address = COALESCE($8, address),
           notes = COALESCE($9, notes),
           credit_days = COALESCE($10, credit_days)
       WHERE id = $1 AND business_id = $2
       RETURNING ${SELECT_COLUMNS}`,
      [
        id,
        businessId,
        data.name ?? null,
        data.taxId ?? null,
        data.contactName ?? null,
        data.email ?? null,
        data.phone ?? null,
        data.address ?? null,
        data.notes ?? null,
        data.creditDays ?? null,
      ],
      client,
    );
    return result.rows[0] ?? null;
  }

  async setActive(
    id: string,
    businessId: string,
    isActive: boolean,
  ): Promise<SupplierRow | null> {
    const result = await this.db.query<SupplierRow>(
      `UPDATE suppliers SET is_active = $3 WHERE id = $1 AND business_id = $2 RETURNING ${SELECT_COLUMNS}`,
      [id, businessId, isActive],
    );
    return result.rows[0] ?? null;
  }

  /** An active supplier with this exact name, ignoring case and surrounding spaces. */
  async findActiveByName(businessId: string, name: string): Promise<SupplierRow | null> {
    const result = await this.db.query<SupplierRow>(
      `SELECT ${SELECT_COLUMNS} FROM suppliers
       WHERE business_id = $1 AND is_active = true AND lower(trim(name)) = lower(trim($2))
       ORDER BY created_at
       LIMIT 1`,
      [businessId, name],
    );
    return result.rows[0] ?? null;
  }
}
