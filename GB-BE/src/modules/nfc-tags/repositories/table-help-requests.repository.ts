import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service';
import { TableHelpRequestRow } from '../domain/table-help-request.interface';
import { ITableHelpRequestsRepository } from './table-help-requests.repository.interface';

const SELECT_COLUMNS = `id, business_id, branch_id, table_number, created_at, attended_at`;

/**
 * How long an unattended request keeps alerting. Past it the request is
 * stale (the shift ended, nobody had Pedidos open): it stops being listed
 * and the table can call again.
 */
const ALERT_WINDOW = `interval '2 hours'`;

@Injectable()
export class TableHelpRequestsRepository implements ITableHelpRequestsRepository {
  constructor(private readonly db: DatabaseService) {}

  async openForTable(
    businessId: string,
    branchId: string,
    tableNumber: string,
  ): Promise<TableHelpRequestRow> {
    const result = await this.db.query<TableHelpRequestRow>(
      `INSERT INTO table_help_requests (business_id, branch_id, table_number)
       VALUES ($1, $2, $3)
       ON CONFLICT (branch_id, table_number) WHERE attended_at IS NULL
       DO UPDATE SET created_at = CASE
         WHEN table_help_requests.created_at < now() - ${ALERT_WINDOW} THEN now()
         ELSE table_help_requests.created_at
       END
       RETURNING ${SELECT_COLUMNS}`,
      [businessId, branchId, tableNumber],
    );
    return result.rows[0];
  }

  async findPending(
    businessId: string,
    branchId?: string,
  ): Promise<TableHelpRequestRow[]> {
    const result = await this.db.query<TableHelpRequestRow>(
      `SELECT ${SELECT_COLUMNS}
       FROM table_help_requests
       WHERE business_id = $1
         AND attended_at IS NULL
         AND created_at >= now() - ${ALERT_WINDOW}
         AND ($2::uuid IS NULL OR branch_id = $2)
       ORDER BY created_at`,
      [businessId, branchId ?? null],
    );
    return result.rows;
  }

  async markAttended(
    id: string,
    businessId: string,
    userId: string,
  ): Promise<TableHelpRequestRow | null> {
    const result = await this.db.query<TableHelpRequestRow>(
      `UPDATE table_help_requests
       SET attended_at = now(), attended_by = $3
       WHERE id = $1 AND business_id = $2 AND attended_at IS NULL
       RETURNING ${SELECT_COLUMNS}`,
      [id, businessId, userId],
    );
    return result.rows[0] ?? null;
  }
}
