-- 093: Each branch runs on its own.
--
-- 1. The menu per branch: a product can be left out of a branch, or sold
--    there at another price. No row means "as in the catalog".
-- 2. Minimum stock per branch: a big branch and a small one need different
--    thresholds. No row means the item's general minimum.
-- 3. Order numbers per branch: each branch counts its own day (0520-01,
--    0520-02...). They were unique per business, which also made a number
--    collide one year later (MMDD repeats); now they are unique per branch
--    and calendar day.

CREATE TABLE product_branch_settings (
  product_id UUID NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches (id) ON DELETE CASCADE,
  is_available BOOLEAN NOT NULL DEFAULT true,
  -- NULL: the catalog's sale_price.
  sale_price NUMERIC(14, 2),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, branch_id),
  CONSTRAINT product_branch_settings_sale_price_check CHECK (sale_price IS NULL OR sale_price >= 0)
);
CREATE INDEX idx_product_branch_settings_branch ON product_branch_settings (branch_id);

CREATE TABLE inventory_item_branch_settings (
  inventory_item_id UUID NOT NULL REFERENCES inventory_items (id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches (id) ON DELETE CASCADE,
  minimum_stock NUMERIC(14, 3) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (inventory_item_id, branch_id),
  CONSTRAINT inventory_item_branch_settings_minimum_stock_check CHECK (minimum_stock >= 0)
);
CREATE INDEX idx_inventory_item_branch_settings_branch ON inventory_item_branch_settings (branch_id);

-- Order numbers: the day each order was numbered on, in its business's timezone.
ALTER TABLE orders ADD COLUMN order_date DATE;
UPDATE orders o
SET order_date = (o.created_at AT TIME ZONE b.timezone)::date
FROM businesses b
WHERE b.id = o.business_id;
ALTER TABLE orders ALTER COLUMN order_date SET NOT NULL;
-- OrdersRepository sets it (the business's day); the default only covers raw inserts.
ALTER TABLE orders ALTER COLUMN order_date SET DEFAULT CURRENT_DATE;

ALTER TABLE orders DROP CONSTRAINT orders_business_id_order_number_key;
ALTER TABLE orders
  ADD CONSTRAINT orders_branch_day_number_key UNIQUE (branch_id, order_date, order_number);
CREATE INDEX idx_orders_business_order_number ON orders (business_id, order_number);

-- The day's counters, now one per branch. Existing ones go to the business's
-- first branch (every business had a single one when this was written).
ALTER TABLE daily_order_counters ADD COLUMN branch_id UUID REFERENCES branches (id);
UPDATE daily_order_counters c
SET branch_id = (
  SELECT b.id FROM branches b WHERE b.business_id = c.business_id ORDER BY b.created_at, b.id LIMIT 1
);
DELETE FROM daily_order_counters WHERE branch_id IS NULL;
ALTER TABLE daily_order_counters ALTER COLUMN branch_id SET NOT NULL;
ALTER TABLE daily_order_counters DROP CONSTRAINT daily_order_counters_pkey;
ALTER TABLE daily_order_counters ADD PRIMARY KEY (business_id, branch_id, order_date);
