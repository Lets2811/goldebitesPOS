export type ExpenseCategory = 'COGS' | 'OPERATING' | 'PAYROLL' | 'MARKETING' | 'OTHER';

/** De dónde salió el dinero del gasto. Refleja `ExpensePaymentSource` de GB-BE. */
export type SelectableExpensePaymentSource = 'CASH_OPERATIONAL' | 'CASH_RESERVE' | 'BANK_ACCOUNT' | 'PERSONAL_MONEY';

/** `UNSPECIFIED_HISTORICAL` solo existe en gastos anteriores a que la fuente fuera obligatoria; no se puede elegir. */
export type ExpensePaymentSource = SelectableExpensePaymentSource | 'UNSPECIFIED_HISTORICAL';

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
  payerName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateExpensePayload {
  category: ExpenseCategory;
  name: string;
  description: string;
  responsible: string;
  amount: number;
  expenseDate: string;
  branchId?: string;
  paymentSource: SelectableExpensePaymentSource;
  /** Quién puso el dinero; obligatorio cuando la fuente es `PERSONAL_MONEY`. */
  payerName?: string;
}

/** La fuente no se cambia editando el gasto: el backend la corrige con una reclasificación auditada. */
export type UpdateExpensePayload = Partial<Omit<CreateExpensePayload, 'paymentSource' | 'payerName'>>;

export interface ExpenseFilters {
  page?: number;
  limit?: number;
  category?: ExpenseCategory;
  dateFrom?: string;
  dateTo?: string;
}

export interface ExpenseCategoryTotal {
  category: ExpenseCategory;
  total: number;
}
