import { z } from 'zod';

/** Mirrors GB-BE's CreateSupplierDto/UpdateSupplierDto. */
export const supplierSchema = z.object({
  name: z.string().min(2, 'Ingresa un nombre válido').max(150),
  taxId: z.string().max(50).optional(),
  contactName: z.string().max(150).optional(),
  email: z.string().email('Ingresa un correo válido').max(150).optional().or(z.literal('')),
  phone: z.string().max(30).optional(),
  address: z.string().max(500).optional(),
  notes: z.string().max(2000).optional(),
  /** Vacío: el proveedor no da crédito fijo. */
  creditDays: z
    .string()
    .refine((value) => value === '' || (/^\d+$/.test(value) && Number(value) <= 365), 'Entre 0 y 365 días')
    .optional(),
});

export type SupplierFormValues = z.infer<typeof supplierSchema>;
