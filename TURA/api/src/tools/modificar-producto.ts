import { z } from 'zod';
import type { Session } from '../auth.js';
import { assertOwnBranch, pesos, readProduct } from './inventory-shared.js';
import { defineWriteTool, ToolRefusedError } from './types.js';

const input = z.object({
  producto_id: z.uuid().describe('El "id" del producto, tal como lo devolvió consultar_productos.'),
  accion: z
    .enum(['activar', 'desactivar', 'ocultar', 'mostrar', 'cambiar_precio'])
    .describe(
      '"desactivar": deja de venderse en el POS y en el menú. "activar": vuelve a venderse. ' +
        '"ocultar": sigue vendiéndose en el POS pero no aparece en el menú que ven los clientes. ' +
        '"mostrar": vuelve a aparecer en ese menú. "cambiar_precio": cambia su precio de venta.',
    ),
  precio: z
    .number()
    .int()
    .min(0)
    .max(100_000_000)
    .optional()
    .describe('Solo para cambiar_precio: el nuevo precio en pesos.'),
});
type Input = z.infer<typeof input>;

async function checked(session: Session, args: Input) {
  const product = await readProduct(session, args.producto_id);
  assertOwnBranch(session, product.branchId, `"${product.name}"`);
  const already: Partial<Record<Input['accion'], boolean>> = {
    activar: product.isActive,
    desactivar: !product.isActive,
    ocultar: !product.isVisible,
    mostrar: product.isVisible,
  };
  if (already[args.accion]) {
    const state = { activar: 'activo', desactivar: 'desactivado', ocultar: 'oculto del menú', mostrar: 'visible en el menú' };
    throw new ToolRefusedError(`"${product.name}" ya está ${state[args.accion as keyof typeof state]}.`);
  }
  if (args.accion === 'cambiar_precio') {
    if (args.precio === undefined) {
      throw new ToolRefusedError('Para cambiar el precio falta decir cuál es el nuevo.');
    }
    if (args.precio === product.salePrice) {
      throw new ToolRefusedError(`"${product.name}" ya cuesta ${pesos(product.salePrice)}.`);
    }
  }
  return product;
}

export const modificarProducto = defineWriteTool({
  name: 'modificar_producto',
  description:
    'Activa, desactiva, oculta o muestra un producto del menú, o cambia su precio. Primero búscalo con ' +
    'consultar_productos para tener su "id". Ocultar no es lo mismo que desactivar: un producto oculto se ' +
    'sigue vendiendo en el POS, solo no lo ven los clientes en su menú. Esta herramienta NO hace el cambio: ' +
    'lo deja listo y el usuario lo confirma con un botón en su pantalla. Después de llamarla di qué va a ' +
    'pasar y pídele que lo confirme; nunca digas que ya quedó hecho.',
  permission: 'products.update',
  input,
  async prepare(args, { session }) {
    const product = await checked(session, args);
    const summaries: Record<Input['accion'], string> = {
      activar: `Activar "${product.name}": vuelve a venderse en el POS y en el menú.`,
      desactivar: `Desactivar "${product.name}": deja de venderse en el POS y en el menú.`,
      ocultar: `Ocultar "${product.name}" del menú de los clientes: se sigue vendiendo en el POS.`,
      mostrar: `Mostrar "${product.name}" otra vez en el menú de los clientes.`,
      cambiar_precio: `Cambiar el precio de "${product.name}" de ${pesos(product.salePrice)} a ${pesos(args.precio ?? 0)}.`,
    };
    return { summary: summaries[args.accion] };
  },
  async commit(args, { session }) {
    const product = await checked(session, args);
    switch (args.accion) {
      case 'activar':
      case 'desactivar':
        await session.pos.patch(`/products/${product.id}/status`, { isActive: args.accion === 'activar' });
        return { message: `Listo: "${product.name}" quedó ${args.accion === 'activar' ? 'activo' : 'desactivado'}.` };
      case 'ocultar':
      case 'mostrar':
        await session.pos.patch(`/products/${product.id}/visibility`, { isVisible: args.accion === 'mostrar' });
        return {
          message:
            args.accion === 'ocultar'
              ? `Listo: "${product.name}" ya no aparece en el menú de los clientes.`
              : `Listo: "${product.name}" volvió al menú de los clientes.`,
        };
      case 'cambiar_precio':
        await session.pos.patch(`/products/${product.id}`, { salePrice: args.precio });
        return { message: `Listo: "${product.name}" ahora cuesta ${pesos(args.precio!)}.` };
    }
  },
});
