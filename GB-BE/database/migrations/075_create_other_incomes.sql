-- Migration: 075_create_other_incomes.sql
-- Created: 2026-10-14

-- Money the business receives outside of sales: a supplier refunding a
-- payment, a reimbursement, a partner's contribution... Every income has a
-- destination, the place the money went into, and recording it moves that
-- place's balance — the mirror image of an expense's payment source:
--   CASH_OPERATIONAL -> an INCOME movement in an open cash session
--   CASH_RESERVE / BANK_ACCOUNT -> a CREDIT in that fund's ledger
-- An income is never edited or deleted: voiding it records the reversal
-- (INCOME_REVERSAL / a fund DEBIT) and keeps the row, marked voided.
CREATE TABLE other_incomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses (id),
  branch_id UUID REFERENCES branches (id),
  income_type VARCHAR(30) NOT NULL,
  description VARCHAR(255) NOT NULL,
  received_from VARCHAR(150),
  amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  income_date DATE NOT NULL,
  destination VARCHAR(30) NOT NULL,
  -- Where the money landed, so voiding knows what to reverse. Exactly the
  -- pointer(s) of its destination are set.
  cash_session_id UUID REFERENCES cash_sessions (id),
  cash_movement_id UUID REFERENCES cash_movements (id),
  fund_movement_id UUID REFERENCES fund_movements (id),
  notes TEXT,
  created_by UUID REFERENCES users (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  voided_at TIMESTAMPTZ,
  voided_by UUID REFERENCES users (id),
  void_reason TEXT,
  CONSTRAINT other_incomes_type_check
    CHECK (income_type IN ('SUPPLIER_REFUND', 'REIMBURSEMENT', 'PARTNER_CONTRIBUTION', 'OTHER')),
  CONSTRAINT other_incomes_destination_check
    CHECK (destination IN ('CASH_OPERATIONAL', 'CASH_RESERVE', 'BANK_ACCOUNT')),
  CONSTRAINT other_incomes_void_reason_check
    CHECK (voided_at IS NULL OR void_reason IS NOT NULL)
);

CREATE INDEX idx_other_incomes_business_date ON other_incomes (business_id, income_date DESC);

CREATE TRIGGER update_other_incomes_updated_at
BEFORE UPDATE ON other_incomes
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
