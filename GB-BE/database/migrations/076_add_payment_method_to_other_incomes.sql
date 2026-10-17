-- Migration: 076_add_payment_method_to_other_incomes.sql
-- Created: 2026-10-14

-- Money that goes into a cash session doesn't always arrive as bills: it can
-- be a transfer. A session reconciles cash and transfers separately (expected
-- cash vs. counted cash, expected transfers vs. what reached the account), so
-- an income into a session has to say how it came. Fund destinations don't
-- need it: the fund itself says where the money is.
ALTER TABLE other_incomes
  ADD COLUMN payment_method VARCHAR(10),
  ADD CONSTRAINT other_incomes_payment_method_check
    CHECK (payment_method IS NULL OR payment_method IN ('CASH', 'TRANSFER'));

-- Incomes recorded before this were counted as cash by the session.
UPDATE other_incomes SET payment_method = 'CASH'
WHERE destination = 'CASH_OPERATIONAL' AND payment_method IS NULL;

ALTER TABLE other_incomes
  ADD CONSTRAINT other_incomes_cash_requires_payment_method
    CHECK (destination <> 'CASH_OPERATIONAL' OR payment_method IS NOT NULL);
