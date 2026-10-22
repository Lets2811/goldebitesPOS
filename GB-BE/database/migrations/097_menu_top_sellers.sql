-- 097: Whether the customer's menu opens with "Lo más pedido hoy", the
-- day's best sellers at its branch (business setting, from Configuración →
-- Catálogo y estados). On by default.
ALTER TABLE businesses
  ADD COLUMN menu_top_sellers boolean NOT NULL DEFAULT true;
