-- Migration: 072_create_expense_categories.sql
-- Created: 2026-10-13

-- The kinds of expense a business records, now a list each business manages
-- instead of five fixed values. An expense keeps pointing at its kind by
-- code (expenses.category), so renaming a kind never touches past expenses,
-- and the five that existed keep their codes: nothing already recorded moves.
--
-- is_cost_of_sales marks the kinds that are the cost of what was sold. The
-- finance dashboard reads it to tell gross margin (sales minus those) from
-- the rest of the spending.
CREATE TABLE expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses (id),
  code VARCHAR(20) NOT NULL,
  name VARCHAR(60) NOT NULL,
  is_cost_of_sales BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT expense_categories_business_code_key UNIQUE (business_id, code)
);

CREATE UNIQUE INDEX idx_expense_categories_business_name
  ON expense_categories (business_id, lower(name));

CREATE TRIGGER update_expense_categories_updated_at
BEFORE UPDATE ON expense_categories
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Every existing business starts with the five kinds it already had.
INSERT INTO expense_categories (business_id, code, name, is_cost_of_sales, sort_order)
SELECT b.id, d.code, d.name, d.is_cost_of_sales, d.sort_order
FROM businesses b
CROSS JOIN (
  VALUES
    ('COGS', 'Costo de ventas', true, 1),
    ('OPERATING', 'Gastos operativos', false, 2),
    ('PAYROLL', 'Nómina', false, 3),
    ('MARKETING', 'Marketing', false, 4),
    ('OTHER', 'Otros', false, 5)
) AS d (code, name, is_cost_of_sales, sort_order);

-- The list of valid kinds is now the table's, per business; the service
-- checks an expense's kind against it.
ALTER TABLE expenses DROP CONSTRAINT expenses_category_check;
