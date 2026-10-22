-- Migration: 090_create_discounts.sql
-- Created: 2026-10-20

-- Discounts: a business's promotions (for events and seasons, picked from a
-- list when charging) and coupons (applied by their code), both a percentage
-- of the order's subtotal. At checkout an order can also take a manual
-- percentage instead. One discount per order.
CREATE TABLE discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses (id),
  kind VARCHAR(10) NOT NULL CHECK (kind IN ('PROMOTION', 'COUPON')),
  name VARCHAR(100) NOT NULL,
  description VARCHAR(300),
  -- Coupons only: what the customer gives, stored upper-case.
  code VARCHAR(30),
  percent NUMERIC(5, 2) NOT NULL CHECK (percent > 0 AND percent <= 100),
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  -- Empty: unlimited.
  max_uses INTEGER CHECK (max_uses IS NULL OR max_uses > 0),
  used_count INTEGER NOT NULL DEFAULT 0 CHECK (used_count >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES users (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CHECK ((kind = 'COUPON') = (code IS NOT NULL)),
  CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at)
);

CREATE INDEX idx_discounts_business ON discounts (business_id) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX uq_discounts_coupon_code ON discounts (business_id, code)
  WHERE code IS NOT NULL AND deleted_at IS NULL;

-- What discount an order carries. discount_amount stays the amount taken off;
-- with a percentage it is recomputed whenever the order's items change.
ALTER TABLE orders
  ADD COLUMN discount_percent NUMERIC(5, 2) CHECK (discount_percent IS NULL OR (discount_percent > 0 AND discount_percent <= 100)),
  ADD COLUMN discount_id UUID REFERENCES discounts (id),
  ADD COLUMN discount_source VARCHAR(10) CHECK (discount_source IN ('MANUAL', 'PROMOTION', 'COUPON')),
  ADD COLUMN discount_label VARCHAR(150);

INSERT INTO permissions (code, module, description) VALUES
  ('discounts.manage', 'discounts', 'Crear y administrar promociones y cupones de descuento'),
  ('discounts.apply', 'discounts', 'Aplicar descuentos al cobrar (promoción, cupón o porcentaje manual)')
ON CONFLICT (code) DO NOTHING;

-- Existing businesses' roles (new ones get them with the system roles).
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('discounts.manage', 'discounts.apply')
WHERE r.name IN ('SUPER_ADMIN', 'OWNER', 'MANAGER')
UNION ALL
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code = 'discounts.apply'
WHERE r.name = 'CASHIER'
ON CONFLICT DO NOTHING;
