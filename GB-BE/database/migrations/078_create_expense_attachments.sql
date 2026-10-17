-- Migration: 078_create_expense_attachments.sql
-- Created: 2026-10-14

-- Receipts of a purchase (or any expense): the supplier's invoice, a photo of
-- the ticket, a transfer voucher. Several per expense. The file lives on disk
-- under uploads/expense-attachments (the uploads volume in production); this
-- row is what points at it.
CREATE TABLE expense_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses (id),
  expense_id UUID NOT NULL REFERENCES expenses (id),
  original_file_name VARCHAR(255) NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  file_size_bytes INTEGER NOT NULL CHECK (file_size_bytes > 0),
  uploaded_by UUID REFERENCES users (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_expense_attachments_expense ON expense_attachments (expense_id) WHERE deleted_at IS NULL;
