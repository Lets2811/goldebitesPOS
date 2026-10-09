-- Migration: 071_table_self_service_and_help_requests.sql
-- Created: 2026-10-09

-- Whether customers at this table can send their own order from the NFC
-- menu. When false the menu is browse-only and a waiter takes the order.
-- Defaults to true: that is how every table worked before the flag existed.
ALTER TABLE nfc_tags
  ADD COLUMN self_service_enabled BOOLEAN NOT NULL DEFAULT true;

-- A table asking for staff from its NFC menu. It stays pending until someone
-- marks it attended. There is at most one pending request per table: pressing
-- the button again does not stack alerts.
CREATE TABLE table_help_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses (id),
  branch_id UUID NOT NULL REFERENCES branches (id),
  table_number VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  attended_at TIMESTAMPTZ,
  attended_by UUID REFERENCES users (id)
);

CREATE UNIQUE INDEX idx_table_help_requests_pending_table
  ON table_help_requests (branch_id, table_number)
  WHERE attended_at IS NULL;
CREATE INDEX idx_table_help_requests_pending_business
  ON table_help_requests (business_id, created_at)
  WHERE attended_at IS NULL;
