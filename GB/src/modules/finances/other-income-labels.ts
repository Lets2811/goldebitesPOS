import { normalizeApiError } from '../../lib/api/api-error';
import type { OtherIncomeDestination, OtherIncomePaymentMethod, OtherIncomeType } from './types/other-income.types';

export const OTHER_INCOME_TYPE_LABELS: Record<OtherIncomeType, string> = {
  SUPPLIER_REFUND: 'Devolución de proveedor',
  REIMBURSEMENT: 'Reintegro o reembolso',
  PARTNER_CONTRIBUTION: 'Aporte de socio',
  OTHER: 'Otro',
};

export const OTHER_INCOME_DESTINATION_LABELS: Record<OtherIncomeDestination, string> = {
  CASH_OPERATIONAL: 'Caja del turno',
  CASH_RESERVE: 'Reserva de efectivo',
  BANK_ACCOUNT: 'Cuenta bancaria',
};

export const OTHER_INCOME_PAYMENT_METHOD_LABELS: Record<OtherIncomePaymentMethod, string> = {
  CASH: 'Efectivo',
  TRANSFER: 'Transferencia',
};

/** El destino y, para la caja, cómo llegó: "Caja del turno, por transferencia". */
export function describeIncomeDestination(
  destination: OtherIncomeDestination,
  paymentMethod: OtherIncomePaymentMethod | null,
): string {
  if (destination !== 'CASH_OPERATIONAL') return OTHER_INCOME_DESTINATION_LABELS[destination];
  return paymentMethod === 'TRANSFER' ? 'Caja del turno, por transferencia' : 'Caja del turno, en efectivo';
}

const ERROR_MESSAGES: Record<string, string> = {
  PAYMENT_METHOD_REQUIRED: 'Indica si el dinero llegó en efectivo o por transferencia.',
  NO_OPEN_CASH_SESSION: 'No hay una caja abierta. Abre la caja o elige otro destino.',
  CASH_SESSION_SELECTION_REQUIRED: 'Hay más de una caja abierta: elige a cuál entró el dinero.',
  CASH_SESSION_CLOSED: 'Esa caja ya se cerró. Elige una caja abierta u otro destino.',
  OTHER_INCOME_SESSION_CLOSED:
    'La caja en la que entró este ingreso ya se cerró, así que no se puede anular. Registra un retiro en la caja actual si hace falta corregir.',
  OTHER_INCOME_ALREADY_VOIDED: 'Este ingreso ya estaba anulado.',
  INSUFFICIENT_FUND_BALANCE: 'El fondo ya no tiene saldo suficiente para retirar este ingreso.',
};

/** Los rechazos del backend llegan en inglés; aquí van en términos del negocio. */
export function otherIncomeErrorMessage(error: unknown, destination?: OtherIncomeDestination): string {
  const normalized = normalizeApiError(error);
  const known = normalized.code ? ERROR_MESSAGES[normalized.code] : undefined;
  if (known) return known;
  // Un fondo que nunca se inicializó responde "no encontrado".
  if (normalized.statusCode === 404 && (destination === 'CASH_RESERVE' || destination === 'BANK_ACCOUNT')) {
    return `"${OTHER_INCOME_DESTINATION_LABELS[destination]}" aún no tiene saldo inicial. Configúralo en Finanzas → Fondos o elige otro destino.`;
  }
  return normalized.message;
}
