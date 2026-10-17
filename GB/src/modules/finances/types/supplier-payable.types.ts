import type { SupplierPayableStatus, SupplierPaymentSource } from './expense.types';

export interface SupplierPayment {
  id: string;
  amount: number;
  /** YYYY-MM-DD */
  paymentDate: string;
  source: SupplierPaymentSource;
  notes: string | null;
  createdAt: string;
}

/** Lo que se le debe a un proveedor por una compra a crédito. */
export interface SupplierPayable {
  id: string;
  expenseId: string;
  supplier: { id: string; name: string };
  purchase: { name: string | null; description: string; category: string; date: string };
  branchId: string | null;
  originalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  /** YYYY-MM-DD */
  dueDate: string | null;
  status: SupplierPayableStatus;
  voidReason: string | null;
  createdAt: string;
}

export interface SupplierPayableWithPayments extends SupplierPayable {
  payments: SupplierPayment[];
}

export interface SupplierPayablesSummary {
  pendingTotal: number;
  openCount: number;
  overdueTotal: number;
  overdueCount: number;
}
