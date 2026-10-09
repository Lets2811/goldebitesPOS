/** Los fondos que el negocio configura a mano. Refleja `FundType` de GB-BE (sin el fondo de apertura, que es interno). */
export type FundType = 'CASH_RESERVE' | 'BANK_ACCOUNT';

export interface FundBalance {
  fundType: FundType;
  businessId: string;
  branchId: string | null;
  balance: number;
  /** null mientras el fondo no tenga saldo inicial: hasta entonces no se puede pagar con él. */
  initializedAt: string | null;
}

export interface InitializeFundPayload {
  amount: number;
  /** De dónde sale el saldo inicial; queda como evidencia permanente. */
  notes: string;
  /** Solo para la reserva de efectivo, que es por sede. */
  branchId?: string;
}
