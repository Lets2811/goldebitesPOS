import { z } from 'zod';

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
    // UNSPECIFIED_HISTORICAL no se ofrece: solo llega al editar un gasto antiguo.
    paymentSource: z.enum(['CASH_OPERATIONAL', 'CASH_RESERVE', 'BANK_ACCOUNT', 'PERSONAL_MONEY', 'UNSPECIFIED_HISTORICAL'], {
      errorMap: () => ({ message: 'Selecciona con qué se pagó' }),
    }),
    payerName: z.string().max(150).optional(),
  })
  .superRefine((values, ctx) => {
    if (values.paymentSource === 'PERSONAL_MONEY' && !values.payerName?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['payerName'], message: 'Indica quién pagó' });
    }
  });

export type ExpenseFormValues = z.infer<typeof expenseSchema>;
