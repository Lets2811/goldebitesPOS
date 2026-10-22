-- Migration: 087_create_push_and_courier_calls.sql
-- Created: 2026-10-19

-- Phones that accept push notifications (Web Push), per user: a courier gets
-- them even with the phone locked or the app closed. One row per browser/
-- device; the push service's endpoint identifies it.
CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses (id),
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent VARCHAR(300),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ
);

CREATE INDEX idx_push_subscriptions_user ON push_subscriptions (user_id);

-- "Llamar al domiciliario": the restaurant (POS) or the customer (tracking
-- page) calls the courier of a delivery. The courier's phone gets a push and
-- the app rings until the courier marks it seen.
CREATE TABLE courier_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses (id),
  delivery_id UUID NOT NULL REFERENCES deliveries (id) ON DELETE CASCADE,
  courier_user_id UUID NOT NULL REFERENCES users (id),
  called_by VARCHAR(10) NOT NULL CHECK (called_by IN ('STAFF', 'CUSTOMER')),
  staff_user_id UUID REFERENCES users (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  seen_at TIMESTAMPTZ
);

CREATE INDEX idx_courier_calls_open ON courier_calls (courier_user_id, created_at)
  WHERE seen_at IS NULL;
