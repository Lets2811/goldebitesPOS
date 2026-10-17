-- Migration: 074_add_income_reversal_to_cash_movement_type.sql
-- Created: 2026-10-14

-- Takes back an INCOME that an "other income" put into a cash session, when
-- that income is voided — inserted, never mutates the original INCOME row
-- (insert-only ledger). Own migration file: ALTER TYPE ... ADD VALUE can't
-- share a transaction with DDL/DML that uses the new value, same reason as
-- 060_add_expense_reversal_to_cash_movement_type.sql. Not a manual movement
-- type: only voiding an other income ever produces it.
ALTER TYPE cash_movement_type ADD VALUE 'INCOME_REVERSAL';
