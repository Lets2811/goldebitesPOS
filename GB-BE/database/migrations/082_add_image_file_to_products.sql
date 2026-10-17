-- Migration: 082_add_image_file_to_products.sql
-- Created: 2026-10-16

-- A photo uploaded for the product, stored on disk (uploads/product-images,
-- a Docker volume in production) like the business logo. Served publicly,
-- since the customer menu shows it to people who aren't logged in.
-- image_updated_at versions the photo's URL, so a replaced photo is never
-- served from a cache. image_url stays for a photo linked from elsewhere; an
-- uploaded file takes precedence over it.
ALTER TABLE products
  ADD COLUMN image_path VARCHAR(255),
  ADD COLUMN image_mime_type VARCHAR(100),
  ADD COLUMN image_updated_at TIMESTAMPTZ;
