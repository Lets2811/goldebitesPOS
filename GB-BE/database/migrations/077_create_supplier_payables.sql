-- Migration: 077_create_supplier_payables.sql
-- Created: 2026-10-14

-- Purchases on credit. A purchase is an expense with a supplier; paid in full
-- it works as before (its payment source moves the money). Bought on credit,
-- or paid only in part, its payment source is SUPPLIER_CREDIT: no money moves
-- when it's recorded, and a payable to the supplier tracks what's still owed.
-- Every payment against it moves money out of a real source (the cash session,
-- the cash reserve or the bank account) — the same shape as
-- reimbursement_obligations/reimbursement_payments (055).
--
-- Reporting is cash basis for these purchases: the expense counts on the days
-- it's paid, each payment on its own date, not the full amount on the purchase
-- date (see ExpensesRepository.getDailyTotals/getSummaryByCategory).

-- Default payment term the supplier gives, in days. Proposes the due date of
-- a purchase on credit; each purchase can still set its own.
ALTER TABLE suppliers
  ADD COLUMN credit_days INTEGER,
  ADD CONSTRAINT suppliers_credit_days_check CHECK (credit_days IS NULL OR credit_days BETWEEN 0 AND 365);

ALTER TABLE expenses ADD COLUMN supplier_id UUID REFERENCES suppliers (id);
CREATE INDEX idx_expenses_supplier ON expenses (supplier_id) WHERE supplier_id IS NOT NULL;

ALTER TABLE expenses DROP CONSTRAINT expenses_payment_source_check;
ALTER TABLE expenses ADD CONSTRAINT expenses_payment_source_check
  CHECK (payment_source IN ('CASH_OPERATIONAL', 'CASH_RESERVE', 'BANK_ACCOUNT', 'PERSONAL_MONEY',
                            'UNSPECIFIED_HISTORICAL', 'SUPPLIER_CREDIT'));
ALTER TABLE expenses ADD CONSTRAINT expenses_supplier_credit_requires_supplier
  CHECK (payment_source <> 'SUPPLIER_CREDIT' OR supplier_id IS NOT NULL);

-- One payable per purchase on credit (1:1, UNIQUE on expense_id). Paid and
-- pending amounts are never stored: always SUM(supplier_payments.amount).
-- Only `status` is a real column, kept in sync with the payments.
CREATE TABLE supplier_payables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses (id),
  expense_id UUID NOT NULL UNIQUE REFERENCES expenses (id),
  supplier_id UUID NOT NULL REFERENCES suppliers (id),
  original_amount NUMERIC(14, 2) NOT NULL CHECK (original_amount > 0),
  due_date DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  voided_at TIMESTAMPTZ,
  voided_by UUID REFERENCES users (id),
  void_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT supplier_payables_status_check
    CHECK (status IN ('PENDING', 'PARTIALLY_PAID', 'PAID', 'VOIDED'))
);

CREATE INDEX idx_supplier_payables_business_status ON supplier_payables (business_id, status);
CREATE INDEX idx_supplier_payables_supplier ON supplier_payables (supplier_id);

CREATE TRIGGER update_supplier_payables_updated_at
BEFORE UPDATE ON supplier_payables
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Append-only ledger of payments. Each one points at the movement it made in
-- its source, exactly one pointer set per source.
CREATE TABLE supplier_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payable_id UUID NOT NULL REFERENCES supplier_payables (id),
  business_id UUID NOT NULL REFERENCES businesses (id),
  branch_id UUID REFERENCES branches (id),
  amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  payment_date DATE NOT NULL,
  source VARCHAR(30) NOT NULL,
  cash_session_id UUID REFERENCES cash_sessions (id),
  cash_movement_id UUID REFERENCES cash_movements (id),
  fund_movement_id UUID REFERENCES fund_movements (id),
  notes TEXT,
  created_by UUID REFERENCES users (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT supplier_payments_source_check
    CHECK (source IN ('CASH_OPERATIONAL', 'CASH_RESERVE', 'BANK_ACCOUNT'))
);

CREATE INDEX idx_supplier_payments_payable ON supplier_payments (payable_id);
CREATE INDEX idx_supplier_payments_business_date ON supplier_payments (business_id, payment_date);
