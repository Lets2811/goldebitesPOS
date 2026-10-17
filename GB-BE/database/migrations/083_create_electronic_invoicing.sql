-- Migration: 083_create_electronic_invoicing.sql
-- Created: 2026-10-17

-- Electronic invoicing (DIAN) through Factus, sold as an add-on module
-- ("einvoicing" feature, off until the platform turns it on). Each business
-- invoices with ITS OWN Factus account, NIT and numbering resolution, so the
-- credentials are per business. Secrets are stored encrypted by the API
-- (AES-256-GCM, key in CREDENTIALS_ENCRYPTION_KEY), never in clear text.
CREATE TABLE e_invoicing_settings (
  business_id UUID PRIMARY KEY REFERENCES businesses (id),
  environment VARCHAR(12) NOT NULL DEFAULT 'SANDBOX'
    CHECK (environment IN ('SANDBOX', 'PRODUCTION')),
  client_id VARCHAR(100) NOT NULL,
  client_secret_encrypted TEXT NOT NULL,
  username VARCHAR(150) NOT NULL,
  password_encrypted TEXT NOT NULL,
  -- Factus numbering range ("Factura de Venta") the invoices are numbered from.
  numbering_range_id INTEGER,
  -- The tax the business charges on sales: '04' INC (impuesto al consumo,
  -- restaurants and bars) or '01' IVA.
  tax_code VARCHAR(2) NOT NULL DEFAULT '04' CHECK (tax_code IN ('01', '04')),
  updated_by UUID REFERENCES users (id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One electronic invoice per order. A failed attempt stays (status FAILED,
-- with the provider's errors) and is retried with the same reference_code,
-- which the provider treats as the same document, so a retry never issues
-- a second invoice.
CREATE TABLE electronic_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses (id),
  order_id UUID NOT NULL UNIQUE REFERENCES orders (id),
  reference_code VARCHAR(60) NOT NULL UNIQUE,
  status VARCHAR(10) NOT NULL CHECK (status IN ('ISSUED', 'FAILED')),
  environment VARCHAR(12) NOT NULL,
  number VARCHAR(40),
  cufe VARCHAR(200),
  qr_url TEXT,
  public_url TEXT,
  -- The buyer as invoiced (consumidor final or an identified customer).
  customer JSONB NOT NULL,
  total NUMERIC(14, 2),
  error_message TEXT,
  provider_response JSONB,
  issued_at TIMESTAMPTZ,
  created_by UUID REFERENCES users (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_electronic_invoices_business ON electronic_invoices (business_id, created_at DESC);
