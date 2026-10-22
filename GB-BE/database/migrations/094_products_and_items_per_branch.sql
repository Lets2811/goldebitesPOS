-- 094: Every branch has its own catalog.
--
-- A product and an inventory item belong to one branch: its price, recipe,
-- stock and minimum are that branch's alone, and a new branch starts empty.
-- Bringing a product to another branch makes an independent copy there
-- (see BranchMenuService.copyToBranch).
--
-- This replaces the per-branch settings of 093 (a shared catalog that each
-- branch could leave out or reprice, and per-branch minimums), which are
-- dropped: they never left development.
--
-- Existing products and items go to their business's first branch (every
-- business had a single one when this was written).

ALTER TABLE products ADD COLUMN branch_id UUID REFERENCES branches (id);
UPDATE products p
SET branch_id = (
  SELECT b.id FROM branches b WHERE b.business_id = p.business_id ORDER BY b.created_at, b.id LIMIT 1
);
ALTER TABLE products ALTER COLUMN branch_id SET NOT NULL;
CREATE INDEX idx_products_branch ON products (branch_id);
ALTER TABLE products DROP CONSTRAINT products_business_id_sku_key;
ALTER TABLE products ADD CONSTRAINT products_branch_id_sku_key UNIQUE (branch_id, sku);

ALTER TABLE inventory_items ADD COLUMN branch_id UUID REFERENCES branches (id);
UPDATE inventory_items i
SET branch_id = (
  SELECT b.id FROM branches b WHERE b.business_id = i.business_id ORDER BY b.created_at, b.id LIMIT 1
);
ALTER TABLE inventory_items ALTER COLUMN branch_id SET NOT NULL;
CREATE INDEX idx_inventory_items_branch ON inventory_items (branch_id);
ALTER TABLE inventory_items DROP CONSTRAINT inventory_items_business_id_sku_key;
ALTER TABLE inventory_items ADD CONSTRAINT inventory_items_branch_id_sku_key UNIQUE (branch_id, sku);

DROP TABLE product_branch_settings;
DROP TABLE inventory_item_branch_settings;
