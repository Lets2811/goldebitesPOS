-- Migration: 081_create_option_groups.sql
-- Created: 2026-10-16

-- What a customer can choose on a product, as groups each business defines:
-- Golden Bites has "Salsas" and "Acompañantes"; a bar may have "Mezcladores",
-- "Tamaño" and "Hielo", or none at all. Replaces the two fixed sauces/sides
-- catalogs.
--
-- Existing data moves over as-is: every business that used sauces or sides
-- gets one group for each, the options keep THEIR SAME IDS (so an order
-- carrying the old ids still resolves), each product keeps its max, and each
-- past order item gets its choices copied into option_selections.
--
-- The old tables and columns (sauces, sides, products.max_sauces/max_sides,
-- order_items.sauce_*/side_*) are left untouched and no longer used, as a
-- fallback; a later migration drops them.

CREATE TABLE option_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses (id),
  -- Plural, as it reads above the choices: "Salsas".
  name VARCHAR(40) NOT NULL,
  -- "Salsa": for phrases like "Nueva salsa".
  singular_name VARCHAR(40) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  -- The customer must pick at least one wherever a product offers the group.
  is_required BOOLEAN NOT NULL DEFAULT false,
  -- The max suggested when a product starts offering the group.
  default_max SMALLINT NOT NULL DEFAULT 1 CHECK (default_max BETWEEN 1 AND 20),
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT option_groups_business_id_name_key UNIQUE (business_id, name)
);

CREATE TABLE option_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses (id),
  group_id UUID NOT NULL REFERENCES option_groups (id),
  name VARCHAR(120) NOT NULL,
  description TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT option_items_group_id_name_key UNIQUE (group_id, name)
);

CREATE INDEX idx_option_items_group ON option_items (group_id);

-- Which groups a product offers, and how many of each the customer may pick.
CREATE TABLE product_option_groups (
  product_id UUID NOT NULL REFERENCES products (id),
  group_id UUID NOT NULL REFERENCES option_groups (id),
  max_choices SMALLINT NOT NULL CHECK (max_choices BETWEEN 1 AND 20),
  PRIMARY KEY (product_id, group_id)
);

CREATE INDEX idx_product_option_groups_group ON product_option_groups (group_id);

-- What was chosen, per group, with the names as they were that day:
-- [{"groupId", "groupName", "itemIds": [...], "itemNames": [...]}]
ALTER TABLE order_items
  ADD COLUMN option_selections JSONB NOT NULL DEFAULT '[]';

-- ---------------------------------------------------------------- data

-- One group per old catalog, for each business that used it.
CREATE TEMP TABLE legacy_groups ON COMMIT DROP AS
SELECT b.id AS business_id, slot.kind, gen_random_uuid() AS group_id
FROM businesses b
CROSS JOIN (VALUES ('SAUCES'), ('SIDES')) AS slot (kind)
WHERE (slot.kind = 'SAUCES' AND (
        EXISTS (SELECT 1 FROM sauces s WHERE s.business_id = b.id)
        OR EXISTS (SELECT 1 FROM products p WHERE p.business_id = b.id AND p.max_sauces > 0)))
   OR (slot.kind = 'SIDES' AND (
        EXISTS (SELECT 1 FROM sides s WHERE s.business_id = b.id)
        OR EXISTS (SELECT 1 FROM products p WHERE p.business_id = b.id AND p.max_sides > 0)));

INSERT INTO option_groups (id, business_id, name, singular_name, default_max, display_order)
SELECT group_id, business_id,
       CASE kind WHEN 'SAUCES' THEN 'Salsas' ELSE 'Acompañantes' END,
       CASE kind WHEN 'SAUCES' THEN 'Salsa' ELSE 'Acompañante' END,
       1,
       CASE kind WHEN 'SAUCES' THEN 0 ELSE 1 END
FROM legacy_groups;

-- Same ids as the old rows.
INSERT INTO option_items (id, business_id, group_id, name, description, display_order, is_active, created_at, updated_at)
SELECT s.id, s.business_id, g.group_id, s.name, s.description, s.display_order, s.is_active, s.created_at, s.updated_at
FROM sauces s JOIN legacy_groups g ON g.business_id = s.business_id AND g.kind = 'SAUCES';

INSERT INTO option_items (id, business_id, group_id, name, description, display_order, is_active, created_at, updated_at)
SELECT s.id, s.business_id, g.group_id, s.name, s.description, s.display_order, s.is_active, s.created_at, s.updated_at
FROM sides s JOIN legacy_groups g ON g.business_id = s.business_id AND g.kind = 'SIDES';

INSERT INTO product_option_groups (product_id, group_id, max_choices)
SELECT p.id, g.group_id, LEAST(p.max_sauces, 20)
FROM products p JOIN legacy_groups g ON g.business_id = p.business_id AND g.kind = 'SAUCES'
WHERE p.max_sauces > 0;

INSERT INTO product_option_groups (product_id, group_id, max_choices)
SELECT p.id, g.group_id, LEAST(p.max_sides, 20)
FROM products p JOIN legacy_groups g ON g.business_id = p.business_id AND g.kind = 'SIDES'
WHERE p.max_sides > 0;

-- Past orders: sauces first, then sides, each only when something was chosen.
UPDATE order_items oi
SET option_selections = (
  SELECT COALESCE(jsonb_agg(sel ORDER BY ord), '[]'::jsonb)
  FROM (
    SELECT 1 AS ord, jsonb_build_object(
             'groupId', gs.group_id, 'groupName', 'Salsas',
             'itemIds', to_jsonb(oi.sauce_ids), 'itemNames', to_jsonb(oi.sauce_names)) AS sel
    FROM legacy_groups gs
    WHERE gs.business_id = o.business_id AND gs.kind = 'SAUCES' AND cardinality(oi.sauce_ids) > 0
    UNION ALL
    SELECT 2, jsonb_build_object(
             'groupId', gd.group_id, 'groupName', 'Acompañantes',
             'itemIds', to_jsonb(oi.side_ids), 'itemNames', to_jsonb(oi.side_names))
    FROM legacy_groups gd
    WHERE gd.business_id = o.business_id AND gd.kind = 'SIDES' AND cardinality(oi.side_ids) > 0
  ) parts
)
FROM orders o
WHERE o.id = oi.order_id
  AND (cardinality(oi.sauce_ids) > 0 OR cardinality(oi.side_ids) > 0);
