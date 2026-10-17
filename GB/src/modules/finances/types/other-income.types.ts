export type OtherIncomeType = 'SUPPLIER_REFUND' | 'REIMBURSEMENT' | 'PARTNER_CONTRIBUTION' | 'OTHER';

/** Dónde quedó el dinero: la caja del turno o uno de los fondos. */
export type OtherIncomeDestination = 'CASH_OPERATIONAL' | 'CASH_RESERVE' | 'BANK_ACCOUNT';

/** Cómo llegó el dinero que entra a la caja: cuenta en el cuadre de efectivo o en el de transferencias. */
export type OtherIncomePaymentMethod = 'CASH' | 'TRANSFER';

export interface OtherIncome {
  id: string;
  branchId: string | null;
  incomeType: OtherIncomeType;
  description: string;
  receivedFrom: string | null;
  amount: number;
  /** YYYY-MM-DD */
  incomeDate: string;
  destination: OtherIncomeDestination;
  /** Solo para la caja del turno. */
  paymentMethod: OtherIncomePaymentMethod | null;
  cashSessionId: string | null;
  notes: string | null;
  createdAt: string;
  voidedAt: string | null;
  voidReason: string | null;
}

export interface CreateOtherIncomePayload {
  incomeType: OtherIncomeType;
  description: string;
  receivedFrom?: string;
  amount: number;
  incomeDate: string;
  destination: OtherIncomeDestination;
  /** Obligatorio para la caja del turno. */
  paymentMethod?: OtherIncomePaymentMethod;
  /** Solo para la caja del turno, cuando hay más de una abierta. */
  cashSessionId?: string;
  notes?: string;
}
