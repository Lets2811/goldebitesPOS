import { Inject, Injectable } from '@nestjs/common';
import { EntityNotFoundException } from '../../../common/exceptions';
import { AuditService } from '../../audit/services/audit.service';
import { EXPENSES_REPOSITORY } from '../repositories/expenses.repository.interface';
import type { IExpensesRepository } from '../repositories/expenses.repository.interface';
import { ExpenseAttachmentRow, ExpenseAttachmentsRepository } from '../repositories/expense-attachments.repository';
import { deleteExpenseAttachmentFile } from '../storage/expense-attachment-storage.util';

export interface ExpenseAttachment {
  id: string;
  expenseId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
}

const toDomain = (row: ExpenseAttachmentRow): ExpenseAttachment => ({
  id: row.id,
  expenseId: row.expense_id,
  fileName: row.original_file_name,
  mimeType: row.mime_type,
  sizeBytes: row.file_size_bytes,
  createdAt: row.created_at,
});

/** Receipts of an expense or purchase: the invoice, a photo of the ticket, a transfer voucher. */
@Injectable()
export class ExpenseAttachmentsService {
  constructor(
    private readonly attachmentsRepository: ExpenseAttachmentsRepository,
    @Inject(EXPENSES_REPOSITORY)
    private readonly expensesRepository: IExpensesRepository,
    private readonly auditService: AuditService,
  ) {}

  async add(
    businessId: string,
    expenseId: string,
    file: { originalName: string; path: string; mimeType: string; size: number },
    actorUserId: string,
  ): Promise<ExpenseAttachment> {
    const expense = await this.expensesRepository.findById(expenseId, businessId);
    if (!expense) {
      // The upload already landed on disk: don't leave it orphaned.
      deleteExpenseAttachmentFile(file.path);
      throw new EntityNotFoundException('Expense', expenseId);
    }
    const row = await this.attachmentsRepository.create({
      businessId,
      expenseId,
      originalFileName: file.originalName,
      storagePath: file.path,
      mimeType: file.mimeType,
      fileSizeBytes: file.size,
      uploadedBy: actorUserId,
    });
    await this.auditService.record({
      businessId,
      userId: actorUserId,
      entityType: 'expense',
      entityId: expenseId,
      action: 'ATTACHMENT_ADDED',
      newValues: { attachmentId: row.id, fileName: file.originalName },
    });
    return toDomain(row);
  }

  async list(businessId: string, expenseId: string): Promise<ExpenseAttachment[]> {
    const rows = await this.attachmentsRepository.findByExpense(expenseId, businessId);
    return rows.map(toDomain);
  }

  async getForDownload(businessId: string, expenseId: string, id: string): Promise<ExpenseAttachmentRow> {
    const row = await this.attachmentsRepository.findById(id, expenseId, businessId);
    if (!row) throw new EntityNotFoundException('ExpenseAttachment', id);
    return row;
  }

  async remove(businessId: string, expenseId: string, id: string, actorUserId: string): Promise<void> {
    const row = await this.getForDownload(businessId, expenseId, id);
    await this.attachmentsRepository.softDelete(id);
    deleteExpenseAttachmentFile(row.storage_path);
    await this.auditService.record({
      businessId,
      userId: actorUserId,
      entityType: 'expense',
      entityId: expenseId,
      action: 'ATTACHMENT_REMOVED',
      oldValues: { attachmentId: id, fileName: row.original_file_name },
    });
  }

  countByExpenseIds(expenseIds: string[]): Promise<Map<string, number>> {
    return this.attachmentsRepository.countByExpenseIds(expenseIds);
  }
}
