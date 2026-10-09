import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service';
import { getOffset } from '../../../common/pagination/pagination.util';
import { DbClient } from '../../../database/types/database.types';
import { BranchRow, PaymentPolicy } from '../domain/branch.interface';
import {
  BranchQuery,
  CreateBranchData,
  UpdateBranchData,
} from '../domain/branch.types';
import { IBranchesRepository } from './branches.repository.interface';

const SELECT_COLUMNS = `id, business_id, name, address, city, phone, table_count, is_active, payment_policy, created_at, updated_at`;

interface CountRow {
  count: string;
}

@Injectable()
export class BranchesRepository implements IBranchesRepository {
  constructor(private readonly db: DatabaseService) {}

  async create(data: CreateBranchData, client?: DbClient): Promise<BranchRow> {
    const result = await this.db.query<BranchRow>(
      `INSERT INTO branches (business_id, name, address, city, phone, table_count)
       VALUES ($1, $2, $3, $4, $5, COALESCE($6, 20))
       RETURNING ${SELECT_COLUMNS}`,
      [
        data.businessId,
        data.name,
        data.address ?? null,
        data.city ?? null,
        data.phone ?? null,
        data.tableCount ?? null,
      ],
      client,
    );
    return result.rows[0];
  }

  async findById(
    id: string,
    businessId: string,
    client?: DbClient,
  ): Promise<BranchRow | null> {
    const result = await this.db.query<BranchRow>(
      `SELECT ${SELECT_COLUMNS} FROM branches WHERE id = $1 AND business_id = $2`,
      [id, businessId],
      client,
    );
    return result.rows[0] ?? null;
  }

  async findAll(
    query: BranchQuery,
  ): Promise<{ rows: BranchRow[]; total: number }> {
    const conditions: string[] = ['business_id = $1'];
    const params: unknown[] = [query.businessId];

    if (query.isActive !== undefined) {
      params.push(query.isActive);
      conditions.push(`is_active = $${params.length}`);
    }

    if (query.search) {
      params.push(`%${query.search}%`);
      conditions.push(`name ILIKE $${params.length}`);
    }

    const whereClause = conditions.join(' AND ');

    const countResult = await this.db.query<CountRow>(
      `SELECT COUNT(*)::text AS count FROM branches WHERE ${whereClause}`,
      params,
    );
    const total = parseInt(countResult.rows[0]?.count ?? '0', 10);

    const dataParams = [
      ...params,
      query.limit,
      getOffset(query.page, query.limit),
    ];
    const rowsResult = await this.db.query<BranchRow>(
      `SELECT ${SELECT_COLUMNS}
       FROM branches
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
    data: UpdateBranchData,
    client?: DbClient,
  ): Promise<BranchRow | null> {
    const result = await this.db.query<BranchRow>(
      `UPDATE branches
       SET name = COALESCE($3, name),
           address = COALESCE($4, address),
           city = COALESCE($5, city),
           phone = COALESCE($6, phone),
           table_count = COALESCE($7, table_count)
       WHERE id = $1 AND business_id = $2
       RETURNING ${SELECT_COLUMNS}`,
      [
        id,
        businessId,
        data.name ?? null,
        data.address ?? null,
        data.city ?? null,
        data.phone ?? null,
        data.tableCount ?? null,
      ],
      client,
    );
    return result.rows[0] ?? null;
  }

  async setActive(
    id: string,
    businessId: string,
    isActive: boolean,
  ): Promise<BranchRow | null> {
    const result = await this.db.query<BranchRow>(
      `UPDATE branches SET is_active = $3 WHERE id = $1 AND business_id = $2 RETURNING ${SELECT_COLUMNS}`,
      [id, businessId, isActive],
    );
    return result.rows[0] ?? null;
  }

  async setPaymentPolicy(
    id: string,
    businessId: string,
    paymentPolicy: PaymentPolicy,
  ): Promise<BranchRow | null> {
    const result = await this.db.query<BranchRow>(
      `UPDATE branches SET payment_policy = $3 WHERE id = $1 AND business_id = $2 RETURNING ${SELECT_COLUMNS}`,
      [id, businessId, paymentPolicy],
    );
    return result.rows[0] ?? null;
  }

  async findActiveIds(businessId: string, limit: number): Promise<string[]> {
    const result = await this.db.query<{ id: string }>(
      `SELECT id FROM branches WHERE business_id = $1 AND is_active = true ORDER BY created_at, id LIMIT $2`,
      [businessId, limit],
    );
    return result.rows.map((row) => row.id);
  }

  async delete(id: string, businessId: string): Promise<boolean> {
    // Every branch has audit entries from the moment it is created, and they
    // would keep it from ever being deleted. They stay, no longer pointing at
    // the branch. It is one statement, so if anything else still refers to
    // the branch the delete fails and the audit entries are left as they were.
    const result = await this.db.query(
      `WITH detached AS (
         UPDATE audit_logs SET branch_id = NULL WHERE branch_id = $1 AND business_id = $2
       )
       DELETE FROM branches WHERE id = $1 AND business_id = $2`,
      [id, businessId],
    );
    return result.rowCount > 0;
  }

  async existsByName(
    businessId: string,
    name: string,
    excludeId?: string,
  ): Promise<boolean> {
    const result = await this.db.query<{ id: string }>(
      `SELECT id FROM branches WHERE business_id = $1 AND name = $2 AND ($3::uuid IS NULL OR id != $3)`,
      [businessId, name, excludeId ?? null],
    );
    return result.rows.length > 0;
  }
}
