import { existsSync, mkdirSync, unlink } from 'node:fs';
import { join } from 'node:path';

/**
 * Inside uploads/, which is a named Docker volume in production
 * (docker-compose.prod.yml), so receipts survive a container rebuild.
 */
export const EXPENSE_ATTACHMENTS_UPLOADS_DIR =
  process.env.EXPENSE_ATTACHMENTS_UPLOADS_DIR ?? join(process.cwd(), 'uploads', 'expense-attachments');

export const EXPENSE_ATTACHMENT_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
export const EXPENSE_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

export function ensureExpenseAttachmentsUploadsDir(): void {
  if (!existsSync(EXPENSE_ATTACHMENTS_UPLOADS_DIR)) {
    mkdirSync(EXPENSE_ATTACHMENTS_UPLOADS_DIR, { recursive: true });
  }
}

/** Best-effort delete — a missing file should never block removing the row. */
export function deleteExpenseAttachmentFile(storagePath: string): void {
  unlink(storagePath, () => undefined);
}
