-- Migration: 086_create_delivery_help_requests.sql
-- Created: 2026-10-19

-- "Llamar al restaurante" from a delivery: the customer (public tracking
-- page) or the courier (their app) asks the business to look at it. Like a
-- table's call for help (table_help_requests), it sounds on the POS until
-- someone marks it attended.
CREATE TABLE delivery_help_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses (id),
  branch_id UUID NOT NULL REFERENCES branches (id),
  delivery_id UUID NOT NULL REFERENCES deliveries (id) ON DELETE CASCADE,
  requested_by VARCHAR(10) NOT NULL CHECK (requested_by IN ('CUSTOMER', 'COURIER')),
  reason VARCHAR(200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  attended_at TIMESTAMPTZ,
  attended_by UUID REFERENCES users (id)
);

-- Calling again while a call is still open does not stack a second one.
CREATE UNIQUE INDEX uq_delivery_help_open ON delivery_help_requests (delivery_id, requested_by)
  WHERE attended_at IS NULL;
CREATE INDEX idx_delivery_help_pending ON delivery_help_requests (business_id, created_at)
  WHERE attended_at IS NULL;
