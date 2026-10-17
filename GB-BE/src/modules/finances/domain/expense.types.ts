import { SupplierPaymentInput } from './supplier-payable.types';

/**
 * The code of the expense category an expense is recorded under — one of the
 * business's own (see ExpenseCategoriesService), which it can add to and rename.
 */
export type ExpenseCategory = string;

/** Which fund an expense drew from — determines what gets debited and whether it affects the cash session's expected cash. */
export enum ExpensePaymentSource {
  CASH_OPERATIONAL = 'CASH_OPERATIONAL',
  CASH_RESERVE = 'CASH_RESERVE',
  BANK_ACCOUNT = 'BANK_ACCOUNT',
  PERSONAL_MONEY = 'PERSONAL_MONEY',
  /** BR-07: expenses created before a source was required. Never selectable — only ever assigned by the migration or reclassified away from. */
  UNSPECIFIED_HISTORICAL = 'UNSPECIFIED_HISTORICAL',
  /**
   * A purchase bought on credit (or paid only in part): no money moves when it's
   * recorded; a supplier payable tracks what's owed and each payment moves money
   * out of its own source. Requires a supplier.
   */
  SUPPLIER_CREDIT = 'SUPPLIER_CREDIT',
}

/** Every source an expense can be created with: the selectable ones plus a purchase on credit. */
export const CREATABLE_EXPENSE_PAYMENT_SOURCES = [
  ExpensePaymentSource.CASH_OPERATIONAL,
  ExpensePaymentSource.CASH_RESERVE,
  ExpensePaymentSource.BANK_ACCOUNT,
  ExpensePaymentSource.PERSONAL_MONEY,
  ExpensePaymentSource.SUPPLIER_CREDIT,
] as const;

/** The 4 real sources a user can pick — UNSPECIFIED_HISTORICAL is a migration/legacy marker only (AC-01, BR-07). */
export const SELECTABLE_EXPENSE_PAYMENT_SOURCES = [
  ExpensePaymentSource.CASH_OPERATIONAL,
  ExpensePaymentSource.CASH_RESERVE,
  ExpensePaymentSource.BANK_ACCOUNT,
  ExpensePaymentSource.PERSONAL_MONEY,
] as const;

export interface CreateExpenseData {
  businessId: string;
  branchId?: string;
  category: ExpenseCategory;
  name: string;
  description: string;
  responsible: string;
  amount: number;
  expenseDate: string;
  paymentSource: ExpensePaymentSource;
  payerEmployeeId?: string;
  payerName?: string;
  /** CASH_OPERATIONAL only — disambiguates when the business has more than one open session (AC-03). */
  cashSessionId?: string;
  /** Who it was bought from. Required for SUPPLIER_CREDIT (this or newSupplierName), optional otherwise. */
  supplierId?: string;
  /** A supplier typed in instead of picked: reused if one is already called that, created otherwise. */
  newSupplierName?: string;
  /** SUPPLIER_CREDIT only: when the rest is due (YYYY-MM-DD). Defaults to the supplier's credit days. */
  dueDate?: string;
  /** SUPPLIER_CREDIT only: what was paid right away, for a partial payment. */
  initialPayment?: SupplierPaymentInput;
}

export interface UpdateExpenseData {
  branchId?: string;
  category?: ExpenseCategory;
  name?: string;
  description?: string;
  responsible?: string;
  amount?: number;
  expenseDate?: string;
}

export interface ReclassifyExpenseSourceData {
  paymentSource: ExpensePaymentSource;
  payerEmployeeId?: string;
  payerName?: string;
  branchId?: string;
  cashSessionId?: string;
  reason: string;
  actorUserId: string;
}

export interface ExpenseQuery {
  businessId: string;
  page: number;
  limit: number;
  category?: ExpenseCategory;
  paymentSource?: ExpensePaymentSource;
  dateFrom?: string;
  dateTo?: string;
}

export interface ExpenseSummaryQuery {
  businessId: string;
  dateFrom: string;
  dateTo: string;
}

export interface ExpenseDailyTotal {
  /** Calendar day (YYYY-MM-DD) the expenses are dated. */
  date: string;
  total: number;
}

export interface ExpenseCategoryTotal {
  category: ExpenseCategory;
  total: number;
}
