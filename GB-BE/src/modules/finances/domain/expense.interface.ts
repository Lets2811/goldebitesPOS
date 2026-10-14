import { ExpenseCategory, ExpensePaymentSource } from './expense.types';

export interface Expense {
  id: string;
  businessId: string;
  branchId: string | null;
  category: ExpenseCategory;
  name: string | null;
  description: string;
  responsible: string | null;
  amount: number;
  expenseDate: string;
  paymentSource: ExpensePaymentSource;
  payerEmployeeId: string | null;
  payerName: string | null;
  /** Pointer to this expense's current effect in the ledger — see 059_evolve_expense_payment_source.sql. */
  cashSessionId: string | null;
  cashMovementId: string | null;
  fundMovementId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExpenseRow {
  id: string;
  business_id: string;
  branch_id: string | null;
  category: ExpenseCategory;
  name: string | null;
  description: string;
  responsible: string | null;
  amount: string;
  expense_date: string;
  payment_source: ExpensePaymentSource;
  payer_employee_id: string | null;
  payer_name: string | null;
  cash_session_id: string | null;
  cash_movement_id: string | null;
  fund_movement_id: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface ExpenseDailyTotalRow {
  date: string;
  total: string;
}

export interface ExpenseCategoryTotalRow {
  category: ExpenseCategory;
  total: string;
}
