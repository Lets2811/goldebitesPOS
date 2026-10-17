import { z } from 'zod';

/** Shared shape for the simple name/description/displayOrder catalogs: categories and the options of each option group. */
export const catalogSchema = z.object({
  name: z.string().min(2, 'Ingresa un nombre válido').max(120),
  description: z.string().max(1000).optional(),
  displayOrder: z.coerce.number().int().min(0).optional(),
});

export type CatalogFormValues = z.infer<typeof catalogSchema>;
