-- Migration: 080_add_builder_display_order_to_product_categories.sql
-- Created: 2026-10-16

-- The order of a category's section inside "Arma tu combo", separate from
-- its order in the regular menu (display_order): the same section can go in
-- a different place in each. Starts as a copy of the menu order, so nothing
-- moves until the administrator rearranges it.
ALTER TABLE product_categories ADD COLUMN builder_display_order INTEGER NOT NULL DEFAULT 0;

UPDATE product_categories SET builder_display_order = display_order;
