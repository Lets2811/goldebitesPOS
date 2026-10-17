import type { PaymentMethod } from '../../orders/types/payment.types';

export type CashSessionStatus = 'OPEN' | 'CLOSED' | 'RECTIFYING';

export type CashMovementType =
  | 'OPENING'
  | 'SALE'
  | 'INCOME'
  | 'EXPENSE'
  | 'WITHDRAWAL'
  | 'CLOSING'
  | 'REIMBURSEMENT'
  | 'EXPENSE_REVERSAL'
  | 'INCOME_REVERSAL';

/** Movement types a user can submit manually — SALE/OPENING/CLOSING are system-generated. */
export type ManualCashMovementType = 'INCOME' | 'EXPENSE' | 'WITHDRAWAL';

export interface CashSession {
  id: string;
  businessId: string;
  branchId: string;
  openedBy: string;
  closedBy: string | null;
  openingAmount: number;
  expectedClosingAmount: number | null;
  actualClosingAmount: number | null;
  differenceAmount: number | null;
  expectedTransferAmount: number | null;
  actualTransferAmount: number | null;
  transferDifferenceAmount: number | null;
  status: CashSessionStatus;
  openedAt: string;
  closedAt: string | null;
  notes: string | null;
}

export interface CashMovement {
  id: string;
  cashSessionId: string;
  orderId: string | null;
  movementType: CashMovementType;
  paymentMethod: PaymentMethod | null;
  amount: number;
  description: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface CashSessionWithMovements extends CashSession {
  movements: CashMovement[];
}

export interface OpenCashSessionPayload {
  branchId: string;
  openingAmount: number;
  notes?: string;
}

export interface CloseCashSessionPayload {
  actualClosingAmount: number;
  actualTransferAmount?: number;
  notes?: string;
}

export interface CreateCashMovementPayload {
  movementType: ManualCashMovementType;
  amount: number;
  description?: string;
}

export interface ReopenCashSessionPayload {
  masterKey: string;
  reason: string;
}

export interface CashSessionFilters {
  page?: number;
  limit?: number;
  branchId?: string;
  status?: CashSessionStatus;
}
