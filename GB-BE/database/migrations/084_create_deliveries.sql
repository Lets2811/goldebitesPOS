-- Migration: 084_create_deliveries.sql
-- Created: 2026-10-19

-- Domicilios: deliveries from a branch to an address, priced by the route's
-- distance and assigned to a courier. A module of its own ("deliveries"
-- feature, off until the platform turns it on). A delivery can stand alone
-- or be linked to an order of the POS.

-- How a business prices its deliveries: an optional base fee plus a price per
-- unit of distance (e.g. $1.000 per 1 km, or per 500 m), with an optional
-- minimum, rounded up to a step (e.g. to the next $100).
CREATE TABLE delivery_settings (
  business_id UUID PRIMARY KEY REFERENCES businesses (id),
  base_fee NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (base_fee >= 0),
  price_per_unit NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (price_per_unit >= 0),
  unit VARCHAR(2) NOT NULL DEFAULT 'KM' CHECK (unit IN ('KM', 'M')),
  -- How much distance one unit is, in `unit` (1 KM, 500 M...).
  unit_size NUMERIC(10, 2) NOT NULL DEFAULT 1 CHECK (unit_size > 0),
  -- PROPORTIONAL charges the exact fraction travelled; FULL_UNITS charges
  -- every unit started (2.1 km at "per 1 km" is 3 units).
  billing_mode VARCHAR(12) NOT NULL DEFAULT 'PROPORTIONAL'
    CHECK (billing_mode IN ('PROPORTIONAL', 'FULL_UNITS')),
  minimum_fee NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (minimum_fee >= 0),
  rounding_step NUMERIC(14, 2) NOT NULL DEFAULT 100 CHECK (rounding_step >= 0),
  updated_by UUID REFERENCES users (id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Where each branch is on the map: the starting point of its deliveries.
CREATE TABLE delivery_branch_locations (
  branch_id UUID PRIMARY KEY REFERENCES branches (id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses (id),
  latitude NUMERIC(9, 6) NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude NUMERIC(9, 6) NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  updated_by UUID REFERENCES users (id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_delivery_branch_locations_business ON delivery_branch_locations (business_id);

CREATE TABLE deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses (id),
  branch_id UUID NOT NULL REFERENCES branches (id),
  order_id UUID REFERENCES orders (id),
  -- A POS user with the courier role (COURIER).
  courier_user_id UUID REFERENCES users (id),
  status VARCHAR(12) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'ASSIGNED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED')),
  -- Point A: the branch, or wherever its pin was dragged for this delivery.
  origin_latitude NUMERIC(9, 6) NOT NULL,
  origin_longitude NUMERIC(9, 6) NOT NULL,
  -- Point B.
  destination_address TEXT NOT NULL,
  destination_details VARCHAR(200),
  destination_latitude NUMERIC(9, 6) NOT NULL,
  destination_longitude NUMERIC(9, 6) NOT NULL,
  customer_name VARCHAR(150),
  customer_phone VARCHAR(30),
  notes TEXT,
  -- The route by road, as the map computed it.
  distance_meters INTEGER NOT NULL CHECK (distance_meters >= 0),
  duration_seconds INTEGER CHECK (duration_seconds >= 0),
  fee NUMERIC(14, 2) NOT NULL CHECK (fee >= 0),
  -- The pricing the fee was computed with, as it was then.
  pricing JSONB NOT NULL,
  created_by UUID REFERENCES users (id),
  assigned_at TIMESTAMPTZ,
  picked_up_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (origin_latitude BETWEEN -90 AND 90 AND destination_latitude BETWEEN -90 AND 90),
  CHECK (origin_longitude BETWEEN -180 AND 180 AND destination_longitude BETWEEN -180 AND 180)
);

CREATE INDEX idx_deliveries_business_created ON deliveries (business_id, created_at DESC);
CREATE INDEX idx_deliveries_courier ON deliveries (courier_user_id) WHERE courier_user_id IS NOT NULL;
-- An order has at most one live delivery; a cancelled one does not count.
CREATE UNIQUE INDEX uq_deliveries_order_live ON deliveries (order_id)
  WHERE order_id IS NOT NULL AND status <> 'CANCELLED';

-- The module's permissions. The API seeds its permission catalog after
-- migrations, but existing businesses' roles are not re-synced, so the
-- codes and their grants are added here for every business.
INSERT INTO permissions (code, module, description) VALUES
  ('deliveries.read', 'deliveries', 'Ver domicilios'),
  ('deliveries.manage', 'deliveries', 'Crear domicilios, asignar domiciliario y cambiar su estado'),
  ('deliveries.configure', 'deliveries', 'Configurar la tarifa de domicilios y la ubicación de las sedes')
ON CONFLICT (code) DO NOTHING;

-- The courier role, for every existing business (new ones get it with the
-- rest of the system roles).
INSERT INTO roles (business_id, name, description)
SELECT b.id, 'COURIER', 'Domiciliario'
FROM businesses b
ON CONFLICT (business_id, name) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('deliveries.read', 'deliveries.manage', 'deliveries.configure')
WHERE r.name IN ('SUPER_ADMIN', 'OWNER', 'MANAGER')
UNION ALL
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('deliveries.read', 'deliveries.manage')
WHERE r.name = 'CASHIER'
UNION ALL
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code = 'deliveries.read'
WHERE r.name = 'COURIER'
ON CONFLICT DO NOTHING;
