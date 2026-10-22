-- 091: Whether the checkout offers the "Descuento" section (business setting,
-- from Configuración → Impuestos, pagos y canales de venta). On by default.
ALTER TABLE businesses
  ADD COLUMN discounts_at_checkout boolean NOT NULL DEFAULT true;
