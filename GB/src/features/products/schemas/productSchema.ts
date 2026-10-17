import { z } from 'zod';

/** Mirrors GB-BE's CreateProductDto/UpdateProductDto. */
export const productSchema = z.object({
  name: z.string().min(2, 'Ingresa un nombre válido').max(150),
  categoryId: z.string().optional(),
  description: z.string().max(2000).optional(),
  sku: z.string().max(60).optional(),
  salePrice: z.coerce.number().min(0, 'El precio no puede ser negativo'),
  trackInventory: z.boolean(),
  inventoryItemId: z.string().optional(),
  inventoryQuantity: z.coerce.number().min(0.001).optional(),
  /** Los grupos de opciones que ofrece y cuántas de cada uno se eligen. */
  optionGroups: z.array(z.object({ groupId: z.string(), maxChoices: z.coerce.number().int().min(1).max(20) })),
  menuAvailability: z.enum(['MENU', 'BUILDER', 'BOTH']),
});

export type ProductFormValues = z.infer<typeof productSchema>;
