-- Migration: 069_create_tura_links.sql
-- Created: 2026-10-07

-- TURA (the assistant, a separate service and app) reads a business's data
-- through this API. A person links their TURA app to a business by telling it
-- a short code generated here by someone who can manage the business's
-- settings; redeeming the code creates a link, whose token TURA then
-- exchanges for short-lived, read-only access tokens.

-- One-time codes. Short enough to say aloud, so they live for minutes and
-- are stored hashed like every other secret.
CREATE TABLE tura_link_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses (id),
  code_hash VARCHAR(64) NOT NULL,
  created_by UUID REFERENCES users (id),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tura_link_codes_hash ON tura_link_codes (code_hash);

-- One row per linked TURA app. user_name is what the person said their name
-- was when linking: it identifies the link to whoever reviews them, it is
-- not a POS user.
CREATE TABLE tura_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses (id),
  user_name VARCHAR(100) NOT NULL,
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tura_links_business ON tura_links (business_id);
