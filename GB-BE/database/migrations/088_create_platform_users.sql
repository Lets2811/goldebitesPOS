-- Migration: 088_create_platform_users.sql
-- Created: 2026-10-19

-- The Golden Bites team's accounts (the Admin app, admin.goldenbites.net),
-- apart from the restaurants' users. Until now a platform admin was a
-- restaurant user flagged users.is_platform_admin, member of an internal
-- business ("Golden Bites POS") with an OWNER role there. Now platform
-- accounts have no business, no role of a restaurant and their own sessions:
-- a POS token is not accepted by the Admin API, nor the other way round.
CREATE TABLE platform_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(150) NOT NULL,
  password_hash TEXT NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL DEFAULT '',
  -- One role today; the column is there for support/sales accounts later.
  role VARCHAR(20) NOT NULL DEFAULT 'ADMIN' CHECK (role IN ('ADMIN')),
  status VARCHAR(10) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  must_change_password BOOLEAN NOT NULL DEFAULT false,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_platform_users_email ON platform_users (lower(email));

CREATE TABLE platform_refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_user_id UUID NOT NULL REFERENCES platform_users (id) ON DELETE CASCADE,
  token_hash VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  ip_address VARCHAR(64),
  user_agent VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_platform_refresh_tokens_user ON platform_refresh_tokens (platform_user_id);

-- Who did it, when it was the Golden Bites team (user_id stays for restaurant users).
ALTER TABLE audit_logs ADD COLUMN platform_user_id UUID REFERENCES platform_users (id);

-- Businesses that are not customers (the old internal "Golden Bites POS"):
-- hidden from the Admin's list of businesses.
ALTER TABLE businesses ADD COLUMN is_internal BOOLEAN NOT NULL DEFAULT false;

-- The existing platform admins become platform accounts, same email and password.
INSERT INTO platform_users (email, password_hash, first_name, last_name, must_change_password, created_at)
SELECT u.email, u.password_hash, u.first_name, u.last_name, u.must_change_password, u.created_at
FROM users u
WHERE u.is_platform_admin AND u.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM platform_users p WHERE lower(p.email) = lower(u.email));

-- Their old restaurant-side accounts and internal business are retired, not
-- deleted: the audit history keeps pointing at them.
UPDATE businesses SET is_internal = true, is_active = false
WHERE id IN (SELECT business_id FROM users WHERE is_platform_admin);

UPDATE users SET status = 'INACTIVE', is_platform_admin = false, updated_at = now()
WHERE is_platform_admin;
