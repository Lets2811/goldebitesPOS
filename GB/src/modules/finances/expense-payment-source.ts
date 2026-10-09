import { normalizeApiError } from '../../lib/api/api-error';
import type {
  CreateExpensePayload,
  Expense,
  ExpensePaymentSource,
  SelectableExpensePaymentSource,
  UpdateExpensePayload,
} from './types/expense.types';

export const EXPENSE_PAYMENT_SOURCE_LABELS: Record<ExpensePaymentSource, string> = {
  CASH_OPERATIONAL: 'Caja (efectivo del turno)',
  CASH_RESERVE: 'Reserva de efectivo',
  BANK_ACCOUNT: 'Cuenta bancaria',
  PERSONAL_MONEY: 'Dinero personal',
  UNSPECIFIED_HISTORICAL: 'Sin especificar',
};

export const SELECTABLE_EXPENSE_PAYMENT_SOURCES: SelectableExpensePaymentSource[] = [
  'CASH_OPERATIONAL',
  'CASH_RESERVE',
  'BANK_ACCOUNT',
  'PERSONAL_MONEY',
];

/** Un gasto que ya movió dinero de una fuente no admite cambiar el monto: se elimina y se registra de nuevo. */
export function isExpenseAmountLocked(expense: Pick<Expense, 'paymentSource'>): boolean {
  return expense.paymentSource !== 'UNSPECIFIED_HISTORICAL';
}

interface ExpenseFormLike {
  category: CreateExpensePayload['category'];
  name: string;
  description: string;
  responsible: string;
  amount: number;
  expenseDate: string;
  paymentSource: ExpensePaymentSource;
  payerName?: string;
}

export function toCreateExpensePayload(
  values: ExpenseFormLike,
  branchId?: string,
): CreateExpensePayload {
  const { paymentSource, payerName, ...rest } = values;
  return {
    ...rest,
    branchId,
    // El formulario no deja enviar sin una fuente elegible.
    paymentSource: paymentSource as SelectableExpensePaymentSource,
    payerName: paymentSource === 'PERSONAL_MONEY' ? payerName?.trim() : undefined,
  };
}

export function toUpdateExpensePayload(
  values: ExpenseFormLike,
  expense: Expense,
): UpdateExpensePayload {
  return {
    category: values.category,
    name: values.name,
    description: values.description,
    responsible: values.responsible,
    expenseDate: values.expenseDate,
    ...(isExpenseAmountLocked(expense) ? {} : { amount: values.amount }),
  };
}

/** Los rechazos del backend al aplicar la fuente llegan en inglés; aquí van en términos del negocio. */
const SOURCE_ERROR_MESSAGES: Record<string, string> = {
  NO_OPEN_CASH_SESSION: 'No hay una caja abierta. Abre la caja o elige otra forma de pago.',
  CASH_SESSION_SELECTION_REQUIRED:
    'Hay más de una caja abierta y no se puede saber de cuál salió el dinero. Elige otra forma de pago o deja una sola caja abierta.',
  INSUFFICIENT_FUND_BALANCE: 'Ese fondo no tiene saldo suficiente para este gasto.',
  PAYER_REQUIRED: 'Indica quién pagó con su dinero.',
  BRANCH_REQUIRED: 'No se pudo determinar la sede del gasto. Cierra sesión y vuelve a entrar.',
  INVALID_AMOUNT: 'La cantidad debe ser mayor que cero.',
  AMOUNT_LOCKED_BY_SOURCE:
    'No se puede cambiar la cantidad de este gasto. Elimínalo y regístralo de nuevo.',
};

export function expenseErrorMessage(error: unknown, paymentSource?: ExpensePaymentSource): string {
  const normalized = normalizeApiError(error);
  const known = normalized.code ? SOURCE_ERROR_MESSAGES[normalized.code] : undefined;
  if (known) return known;
  // Un fondo que nunca se inicializó responde "no encontrado".
  if (
    normalized.statusCode === 404 &&
    (paymentSource === 'CASH_RESERVE' || paymentSource === 'BANK_ACCOUNT')
  ) {
    return `"${EXPENSE_PAYMENT_SOURCE_LABELS[paymentSource]}" aún no tiene saldo inicial. Configúralo en Finanzas → Fondos o elige otra forma de pago.`;
  }
  return normalized.message;
}
