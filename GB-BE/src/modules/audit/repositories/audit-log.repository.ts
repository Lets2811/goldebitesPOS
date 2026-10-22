import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service';
import { getOffset } from '../../../common/pagination/pagination.util';
import { DbClient } from '../../../database/types/database.types';
import { AuditLogQuery, AuditLogRow } from '../domain/audit-log.interface';
import { RecordAuditEntryData } from '../domain/audit-log.types';
import { IAuditLogRepository } from './audit-log.repository.interface';

const SELECT_COLUMNS = `id, business_id, branch_id, user_id, entity_type, entity_id, action,
  old_values, new_values, metadata, ip_address::text AS ip_address, user_agent, created_at`;

interface CountRow {
  count: string;
}

@Injectable()
export class AuditLogRepository implements IAuditLogRepository {
  constructor(private readonly db: DatabaseService) {}

  async insert(data: RecordAuditEntryData, client?: DbClient): Promise<void> {
    await this.db.query(
      // The actor is a POS user or a Golden Bites (platform) account: the id
      // lands in the column of the table it belongs to.
      `INSERT INTO audit_logs
         (business_id, branch_id, user_id, platform_user_id, entity_type, entity_id, action, old_values, new_values, metadata, ip_address, user_agent)
       VALUES ($1, $2,
               (SELECT id FROM users WHERE id = $3::uuid),
               (SELECT id FROM platform_users WHERE id = $3::uuid),
               $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        data.businessId ?? null,
        data.branchId ?? null,
        data.userId ?? null,
        data.entityType,
        data.entityId ?? null,
        data.action,
        data.oldValues ? JSON.stringify(data.oldValues) : null,
        data.newValues ? JSON.stringify(data.newValues) : null,
        data.metadata ? JSON.stringify(data.metadata) : null,
        data.ipAddress ?? null,
        data.userAgent ?? null,
      ],
      client,
    );
  }

  async findAll(
    query: AuditLogQuery,
  ): Promise<{ rows: AuditLogRow[]; total: number }> {
    const conditions: string[] = ['business_id = $1'];
    const params: unknown[] = [query.businessId];

    if (query.entityType) {
      params.push(query.entityType);
      conditions.push(`entity_type = $${params.length}`);
    }
    if (query.entityId) {
      params.push(query.entityId);
      conditions.push(`entity_id = $${params.length}`);
    }
    if (query.userId) {
      params.push(query.userId);
      conditions.push(`user_id = $${params.length}`);
    }
    if (query.action) {
      params.push(query.action);
      conditions.push(`action = $${params.length}`);
    }
    if (query.dateFrom) {
      params.push(query.dateFrom);
      conditions.push(`created_at >= $${params.length}`);
    }
    if (query.dateTo) {
      params.push(query.dateTo);
      conditions.push(`created_at <= $${params.length}`);
    }

    const whereClause = conditions.join(' AND ');

    const countResult = await this.db.query<CountRow>(
      `SELECT COUNT(*)::text AS count FROM audit_logs WHERE ${whereClause}`,
      params,
    );
    const total = parseInt(countResult.rows[0]?.count ?? '0', 10);

    const dataParams = [
      ...params,
      query.limit,
      getOffset(query.page, query.limit),
    ];
    const rowsResult = await this.db.query<AuditLogRow>(
      `SELECT ${SELECT_COLUMNS}
       FROM audit_logs
       WHERE ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
      dataParams,
    );

    return { rows: rowsResult.rows, total };
  }
}
