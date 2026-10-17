/** What kind of money came in. */
export enum OtherIncomeType {
  SUPPLIER_REFUND = 'SUPPLIER_REFUND',
  REIMBURSEMENT = 'REIMBURSEMENT',
  PARTNER_CONTRIBUTION = 'PARTNER_CONTRIBUTION',
  OTHER = 'OTHER',
}

/** How money into a cash session arrived: it counts toward that session's cash or its transfers. */
export enum OtherIncomePaymentMethod {
  CASH = 'CASH',
  TRANSFER = 'TRANSFER',
}

/** Where the money went — the place whose balance the income raises. */
export enum OtherIncomeDestination {
  CASH_OPERATIONAL = 'CASH_OPERATIONAL',
  CASH_RESERVE = 'CASH_RESERVE',
  BANK_ACCOUNT = 'BANK_ACCOUNT',
}

export interface OtherIncomeRow {
  id: string;
  business_id: string;
  branch_id: string | null;
  income_type: OtherIncomeType;
  description: string;
  received_from: string | null;
  amount: string;
  /** YYYY-MM-DD, read as text so no timezone can shift the day. */
  income_date: string;
  destination: OtherIncomeDestination;
  payment_method: OtherIncomePaymentMethod | null;
  cash_session_id: string | null;
  cash_movement_id: string | null;
  fund_movement_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: Date;
  voided_at: Date | null;
  void_reason: string | null;
}

export interface OtherIncome {
  id: string;
  branchId: string | null;
  incomeType: OtherIncomeType;
  description: string;
  receivedFrom: string | null;
  amount: number;
  incomeDate: string;
  destination: OtherIncomeDestination;
  /** Only for CASH_OPERATIONAL. */
  paymentMethod: OtherIncomePaymentMethod | null;
  cashSessionId: string | null;
  notes: string | null;
  createdAt: Date;
  voidedAt: Date | null;
  voidReason: string | null;
}

export interface CreateOtherIncomeData {
  businessId: string;
  branchId?: string;
  incomeType: OtherIncomeType;
  description: string;
  receivedFrom?: string;
  amount: number;
  incomeDate: string;
  destination: OtherIncomeDestination;
  /** Required for CASH_OPERATIONAL, ignored otherwise. */
  paymentMethod?: OtherIncomePaymentMethod;
  /** CASH_OPERATIONAL only — which open session received the money, when there's more than one. */
  cashSessionId?: string;
  notes?: string;
}

export interface OtherIncomePointers {
  cashSessionId: string | null;
  cashMovementId: string | null;
  fundMovementId: string | null;
}

export interface OtherIncomeQuery {
  businessId: string;
  dateFrom?: string;
  dateTo?: string;
}
