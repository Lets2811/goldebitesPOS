-- Migration: 089_create_business_master_keys.sql
-- Created: 2026-10-19

-- Each business's master key ("clave maestra"), asked for to rectify a closed
-- cash session. Until now there was a single key for every business
-- (CASH_SESSION_MASTER_KEY); a business without a row here keeps using that
-- one. Stored encrypted (secret-box, CREDENTIALS_ENCRYPTION_KEY), not hashed:
-- the Golden Bites team recovers it from POS-ADMIN when a restaurant forgets
-- it. The POS never shows it.
CREATE TABLE business_master_keys (
  business_id UUID PRIMARY KEY REFERENCES businesses (id),
  key_encrypted TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
