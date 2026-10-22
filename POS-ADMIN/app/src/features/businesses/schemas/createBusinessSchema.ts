import { z } from 'zod';

export const createBusinessSchema = z.object({
  name: z.string().min(2, 'Ingresa un nombre').max(150),
  currency: z.string().length(3),
  timezone: z.string().max(60),
  ownerFirstName: z.string().min(1, 'Ingresa un nombre').max(100),
  ownerLastName: z.string().min(1, 'Ingresa un apellido').max(100),
  ownerEmail: z.string().email('Ingresa un correo válido').max(150),
  ownerPassword: z.string().min(8, 'Mínimo 8 caracteres').max(72),
});

export type CreateBusinessFormValues = z.infer<typeof createBusinessSchema>;
