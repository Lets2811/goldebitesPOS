-- Migration: 085_add_delivery_tracking.sql
-- Created: 2026-10-19

-- Following a delivery: where its courier is (the phone reports it), the
-- path ridden, a public page the customer opens with a code (no login), and
-- a chat between the customer and the courier.

-- The code the customer opens the tracking page with. Short and without
-- look-alike characters (no 0/O, 1/I/L), to be read out or typed.
ALTER TABLE deliveries ADD COLUMN tracking_code VARCHAR(8);

UPDATE deliveries
SET tracking_code = (
  SELECT string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random() * 31)::int, 1), '')
  FROM generate_series(1, 6)
  -- Correlated on the row, so each delivery gets its own code.
  WHERE deliveries.id IS NOT NULL
)
WHERE tracking_code IS NULL;

ALTER TABLE deliveries ALTER COLUMN tracking_code SET NOT NULL;
CREATE UNIQUE INDEX uq_deliveries_tracking_code ON deliveries (tracking_code);

-- The last position each courier's phone reported.
CREATE TABLE courier_locations (
  user_id UUID PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses (id),
  latitude NUMERIC(9, 6) NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude NUMERIC(9, 6) NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  accuracy_meters INTEGER,
  heading SMALLINT,
  speed_mps NUMERIC(6, 2),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_courier_locations_business ON courier_locations (business_id, recorded_at DESC);

-- The path of a delivery while it is on its way.
CREATE TABLE delivery_track_points (
  id BIGSERIAL PRIMARY KEY,
  delivery_id UUID NOT NULL REFERENCES deliveries (id) ON DELETE CASCADE,
  latitude NUMERIC(9, 6) NOT NULL,
  longitude NUMERIC(9, 6) NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_delivery_track_points_delivery ON delivery_track_points (delivery_id, recorded_at);

-- The chat of a delivery: the customer (from the public page), its courier,
-- and the business's staff.
CREATE TABLE delivery_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID NOT NULL REFERENCES deliveries (id) ON DELETE CASCADE,
  sender VARCHAR(10) NOT NULL CHECK (sender IN ('CUSTOMER', 'COURIER', 'STAFF')),
  user_id UUID REFERENCES users (id),
  body VARCHAR(1000) NOT NULL CHECK (length(trim(body)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_delivery_messages_delivery ON delivery_messages (delivery_id, created_at);

-- What a courier does with their own deliveries: start and finish them,
-- report where they are, and chat. Couriers no longer get deliveries.read,
-- which shows every delivery of the business.
INSERT INTO permissions (code, module, description) VALUES
  ('deliveries.deliver', 'deliveries', 'Llevar domicilios: ver los propios, compartir la ubicación y chatear con el cliente')
ON CONFLICT (code) DO NOTHING;

DELETE FROM role_permissions rp
USING roles r, permissions p
WHERE rp.role_id = r.id AND rp.permission_id = p.id
  AND r.name = 'COURIER' AND p.code = 'deliveries.read';

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code = 'deliveries.deliver'
WHERE r.name IN ('COURIER', 'SUPER_ADMIN', 'OWNER')
ON CONFLICT DO NOTHING;
