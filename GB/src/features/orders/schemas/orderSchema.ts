import { z } from 'zod';

export const newOrderItemSchema = z.object({
  productId: z.string().min(1, 'Selecciona un producto'),
  quantity: z.coerce.number().positive('Cantidad inválida'),
  notes: z.string().optional(),
  optionItemIds: z.array(z.string()).optional(),
});

/** Mirrors GB-BE's CreateOrderDto. */
export const newOrderSchema = z
  .object({
    customerId: z.string().optional(),
    customerName: z.string().optional(),
    orderType: z.enum(['DINE_IN', 'TAKEAWAY', 'DELIVERY', 'CAR_SERVICE']),
    tableNumber: z.string().optional(),
    deliveryAddress: z.string().optional(),
    deliveryInstructions: z.string().optional(),
    discountAmount: z.coerce.number().min(0).optional(),
    deliveryFee: z.coerce.number().min(0).optional(),
    notes: z.string().optional(),
    items: z.array(newOrderItemSchema).min(1, 'Agrega al menos un producto'),
  })
  .superRefine((data, ctx) => {
    if (data.orderType === 'DELIVERY' && !data.deliveryAddress) {
      ctx.addIssue({
        code: 'custom',
        path: ['deliveryAddress'],
        message: 'La dirección es obligatoria para pedidos a domicilio',
      });
    }
  });

export type NewOrderFormValues = z.infer<typeof newOrderSchema>;

/** Mirrors GB-BE's ReplaceOrderItemsDto — only items can be edited, and only while PENDING. */
export const editOrderItemsSchema = z.object({
  items: z.array(newOrderItemSchema).min(1, 'Agrega al menos un producto'),
});

export type EditOrderItemsFormValues = z.infer<typeof editOrderItemsSchema>;
