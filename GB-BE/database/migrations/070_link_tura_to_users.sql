-- Migration: 070_link_tura_to_users.sql
-- Created: 2026-10-08

-- A TURA link now belongs to a POS user instead of to whoever happened to
-- hold the device: the user who generated the code is who TURA acts as, with
-- that user's name, branch and (read-only) permissions. The name typed or
-- spoken while linking is no longer needed.
--
-- Both tables are from migration 069 and nothing had been released on them,
-- so the links and codes made while trying the feature are simply dropped.
DELETE FROM tura_links;
DELETE FROM tura_link_codes;

-- The code's creator is the user it links, so it can no longer be missing.
ALTER TABLE tura_link_codes ALTER COLUMN created_by SET NOT NULL;

ALTER TABLE tura_links DROP COLUMN user_name;
ALTER TABLE tura_links ADD COLUMN user_id UUID NOT NULL REFERENCES users (id);

CREATE INDEX idx_tura_links_user ON tura_links (user_id);
