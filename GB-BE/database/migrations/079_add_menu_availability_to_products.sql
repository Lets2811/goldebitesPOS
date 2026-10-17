-- Migration: 079_add_menu_availability_to_products.sql
-- Created: 2026-10-16

-- Where a product is offered to customers ordering on their own (the NFC /
-- public menu): the regular menu, the "Arma tu combo" builder, or both.
-- MENU keeps every existing product exactly where it was. Staff ordering at
-- the POS is unaffected: it always sees every active product.
ALTER TABLE products
  ADD COLUMN menu_availability VARCHAR(10) NOT NULL DEFAULT 'MENU',
  ADD CONSTRAINT products_menu_availability_check
    CHECK (menu_availability IN ('MENU', 'BUILDER', 'BOTH'));
