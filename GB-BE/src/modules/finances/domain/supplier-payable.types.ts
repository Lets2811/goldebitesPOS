export enum SupplierPayableStatus {
  PENDING = 'PENDING',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  PAID = 'PAID',
  VOIDED = 'VOIDED',
}

/** Where a payment to a supplier comes from — the three places the business keeps its own money. */
export enum SupplierPaymentSource {
  CASH_OPERATIONAL = 'CASH_OPERATIONAL',
  CASH_RESERVE = 'CASH_RESERVE',
  BANK_ACCOUNT = 'BANK_ACCOUNT',
}

/** A payable with what's been paid on it and the purchase it comes from. */
export interface SupplierPayableRow {
  id: string;
  business_id: string;
  expense_id: string;
  supplier_id: string;
  supplier_name: string;
  original_amount: string;
  paid_amount: string;
  /** YYYY-MM-DD, read as text so no timezone can shift the day. */
  due_date: string | null;
  status: SupplierPayableStatus;
  expense_name: string | null;
  expense_description: string;
  expense_category: string;
  /** YYYY-MM-DD */
  purchase_date: string;
  branch_id: string | null;
  void_reason: string | null;
  created_at: Date;
}

export interface SupplierPaymentRow {
  id: string;
  payable_id: string;
  amount: string;
  /** YYYY-MM-DD */
  payment_date: string;
  source: SupplierPaymentSource;
  cash_session_id: string | null;
  notes: string | null;
  created_at: Date;
}

export interface SupplierPayment {
  id: string;
  amount: number;
  paymentDate: string;
  source: SupplierPaymentSource;
  notes: string | null;
  createdAt: Date;
}

export interface SupplierPayable {
  id: string;
  expenseId: string;
  supplier: { id: string; name: string };
  purchase: { name: string | null; description: string; category: string; date: string };
  branchId: string | null;
  originalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  dueDate: string | null;
  status: SupplierPayableStatus;
  voidReason: string | null;
  createdAt: Date;
}

export interface SupplierPayableWithPayments extends SupplierPayable {
  payments: SupplierPayment[];
}

/** A payment to record: from where, how much and when. */
export interface SupplierPaymentInput {
  amount: number;
  source: SupplierPaymentSource;
  /** YYYY-MM-DD; defaults to today. */
  paymentDate?: string;
  /** CASH_OPERATIONAL only — which open session paid, when there are several. */
  cashSessionId?: string;
  notes?: string;
}

export interface SupplierPayableQuery {
  businessId: string;
  supplierId?: string;
  /** true: only what's still owed (pending or partially paid). */
  openOnly?: boolean;
}

export interface SupplierPayablesSummary {
  /** Everything still owed. */
  pendingTotal: number;
  openCount: number;
  /** Owed and past its due date. */
  overdueTotal: number;
  overdueCount: number;
}
