import { z } from 'zod';

/** Cómo se pagó una compra: todo de una vez, nada todavía, o una parte ahora y el resto después. */
export type ExpensePaymentMode = 'CASH_PAID' | 'CREDIT' | 'PARTIAL';

const SOURCES = ['CASH_OPERATIONAL', 'CASH_RESERVE', 'BANK_ACCOUNT', 'PERSONAL_MONEY', 'UNSPECIFIED_HISTORICAL', 'SUPPLIER_CREDIT'];
const PAYMENT_SOURCES = ['CASH_OPERATIONAL', 'CASH_RESERVE', 'BANK_ACCOUNT'];

/** Mirrors GB-BE's CreateExpenseDto/UpdateExpenseDto. */
export const expenseSchema = z
  .object({
    // El código de uno de los tipos de gasto del negocio (Configuración → Tipos de gasto).
    category: z.string().min(1, 'Selecciona el tipo de gasto'),
    name: z.string().min(2, 'Ingresa un nombre').max(150),
    description: z.string().min(2, 'Ingresa el motivo').max(255),
    responsible: z.string().min(2, 'Ingresa el responsable').max(150),
    amount: z.coerce.number().min(0, 'La cantidad no puede ser negativa'),
    expenseDate: z.string().min(1, 'Selecciona una fecha'),
    /** Opcional en un gasto de contado; obligatorio si queda algo por pagar. */
    supplierId: z.string(),
    paymentMode: z.enum(['CASH_PAID', 'CREDIT', 'PARTIAL']),
    // De contado: de dónde salió. UNSPECIFIED_HISTORICAL y SUPPLIER_CREDIT solo llegan al editar.
    paymentSource: z.string(),
    payerName: z.string().max(150).optional(),
    /** A crédito o parcial: cuándo vence lo que queda. */
    dueDate: z.string(),
    /** Parcial: cuánto se pagó en el momento y de dónde salió. */
    initialAmount: z.coerce.number().min(0),
    initialSource: z.string(),
  })
  .superRefine((values, ctx) => {
    const issue = (path: string, message: string) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });

    if (values.paymentMode === 'CASH_PAID') {
      if (!SOURCES.includes(values.paymentSource)) issue('paymentSource', 'Selecciona con qué se pagó');
      if (values.paymentSource === 'PERSONAL_MONEY' && !values.payerName?.trim()) issue('payerName', 'Indica quién pagó');
      return;
    }
    if (!values.supplierId) issue('supplierId', 'Elige el proveedor: queda debiéndosele');
    if (values.paymentMode === 'PARTIAL') {
      if (!(values.initialAmount > 0)) issue('initialAmount', 'Indica cuánto se pagó ahora');
      else if (values.initialAmount >= values.amount) {
        issue('initialAmount', 'Si se pagó todo, elige "De contado"');
      }
      if (!PAYMENT_SOURCES.includes(values.initialSource)) issue('initialSource', 'Elige de dónde salió el pago');
    }
  });

export type ExpenseFormValues = z.infer<typeof expenseSchema>;
