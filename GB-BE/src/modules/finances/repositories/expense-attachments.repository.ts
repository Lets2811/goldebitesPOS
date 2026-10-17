import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service';

export interface ExpenseAttachmentRow {
  id: string;
  business_id: string;
  expense_id: string;
  original_file_name: string;
  storage_path: string;
  mime_type: string;
  file_size_bytes: number;
  created_at: Date;
}

const COLUMNS = `id, business_id, expense_id, original_file_name, storage_path, mime_type, file_size_bytes, created_at`;

@Injectable()
export class ExpenseAttachmentsRepository {
  constructor(private readonly db: DatabaseService) {}

  async create(data: {
    businessId: string;
    expenseId: string;
    originalFileName: string;
    storagePath: string;
    mimeType: string;
    fileSizeBytes: number;
    uploadedBy: string;
  }): Promise<ExpenseAttachmentRow> {
    const result = await this.db.query<ExpenseAttachmentRow>(
      `INSERT INTO expense_attachments (business_id, expense_id, original_file_name, storage_path, mime_type, file_size_bytes, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING ${COLUMNS}`,
      [
        data.businessId,
        data.expenseId,
        data.originalFileName,
        data.storagePath,
        data.mimeType,
        data.fileSizeBytes,
        data.uploadedBy,
      ],
    );
    return result.rows[0];
  }

  async findByExpense(expenseId: string, businessId: string): Promise<ExpenseAttachmentRow[]> {
    const result = await this.db.query<ExpenseAttachmentRow>(
      `SELECT ${COLUMNS} FROM expense_attachments
       WHERE expense_id = $1 AND business_id = $2 AND deleted_at IS NULL
       ORDER BY created_at`,
      [expenseId, businessId],
    );
    return result.rows;
  }

  async findById(id: string, expenseId: string, businessId: string): Promise<ExpenseAttachmentRow | null> {
    const result = await this.db.query<ExpenseAttachmentRow>(
      `SELECT ${COLUMNS} FROM expense_attachments
       WHERE id = $1 AND expense_id = $2 AND business_id = $3 AND deleted_at IS NULL`,
      [id, expenseId, businessId],
    );
    return result.rows[0] ?? null;
  }

  async softDelete(id: string): Promise<void> {
    await this.db.query(`UPDATE expense_attachments SET deleted_at = now() WHERE id = $1`, [id]);
  }

  /** How many receipts each expense has, for the list. */
  async countByExpenseIds(expenseIds: string[]): Promise<Map<string, number>> {
    if (expenseIds.length === 0) return new Map();
    const result = await this.db.query<{ expense_id: string; count: string }>(
      `SELECT expense_id, COUNT(*)::text AS count FROM expense_attachments
       WHERE expense_id = ANY($1::uuid[]) AND deleted_at IS NULL
       GROUP BY expense_id`,
      [expenseIds],
    );
    return new Map(result.rows.map((row) => [row.expense_id, parseInt(row.count, 10)]));
  }
}
