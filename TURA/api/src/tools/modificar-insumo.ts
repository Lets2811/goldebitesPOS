import { z } from 'zod';
import type { Session } from '../auth.js';
import { assertOwnBranch, quantity, readItem } from './inventory-shared.js';
import { defineWriteTool, ToolRefusedError } from './types.js';

const input = z.object({
  insumo_id: z.uuid().describe('El "id" del insumo, tal como lo devolvió consultar_inventario.'),
  accion: z
    .enum(['activar', 'desactivar', 'cambiar_minimo'])
    .describe(
      '"desactivar": deja de usarse (no aparece para compras ni recetas nuevas). "activar": lo vuelve a usar. ' +
        '"cambiar_minimo": cambia desde cuántas existencias se avisa que se está acabando.',
    ),
  minimo: z
    .number()
    .min(0)
    .max(1_000_000)
    .optional()
    .describe('Solo para cambiar_minimo: el nuevo mínimo, en la unidad del insumo.'),
});
type Input = z.infer<typeof input>;

async function checked(session: Session, args: Input) {
  const item = await readItem(session, args.insumo_id);
  assertOwnBranch(session, item.branchId, `"${item.name}"`);
  if (args.accion === 'activar' && item.isActive) {
    throw new ToolRefusedError(`"${item.name}" ya está activo.`);
  }
  if (args.accion === 'desactivar' && !item.isActive) {
    throw new ToolRefusedError(`"${item.name}" ya está desactivado.`);
  }
  if (args.accion === 'cambiar_minimo') {
    if (args.minimo === undefined) {
      throw new ToolRefusedError('Para cambiar el mínimo falta decir cuál es el nuevo.');
    }
    if (args.minimo === item.minimumStock) {
      throw new ToolRefusedError(`El mínimo de "${item.name}" ya es ${quantity(item.minimumStock, item.unit)}.`);
    }
  }
  return item;
}

export const modificarInsumo = defineWriteTool({
  name: 'modificar_insumo',
  description:
    'Activa o desactiva un insumo del inventario, o cambia su mínimo (desde cuántas existencias se avisa ' +
    'que se acaba). Para cambiar las existencias usa ajustar_existencias. Primero busca el insumo con ' +
    'consultar_inventario para tener su "id". Esta herramienta NO hace el cambio: lo deja listo y el usuario ' +
    'lo confirma con un botón en su pantalla. Después de llamarla di qué va a pasar y pídele que lo ' +
    'confirme; nunca digas que ya quedó hecho.',
  permission: 'inventory.manage',
  input,
  async prepare(args, { session }) {
    const item = await checked(session, args);
    const summary =
      args.accion === 'activar'
        ? `Activar el insumo "${item.name}": vuelve a estar disponible para compras y recetas.`
        : args.accion === 'desactivar'
          ? `Desactivar el insumo "${item.name}": deja de aparecer para compras y recetas nuevas. Sus existencias (${quantity(item.currentStock, item.unit)}) no cambian.`
          : `Cambiar el mínimo de "${item.name}" de ${quantity(item.minimumStock, item.unit)} a ${quantity(args.minimo!, item.unit)}.`;
    return { summary };
  },
  async commit(args, { session }) {
    const item = await checked(session, args);
    if (args.accion === 'cambiar_minimo') {
      await session.pos.patch(`/inventory-items/${item.id}`, { minimumStock: args.minimo });
      return { message: `Listo: el mínimo de "${item.name}" ahora es ${quantity(args.minimo!, item.unit)}.` };
    }
    const isActive = args.accion === 'activar';
    await session.pos.patch(`/inventory-items/${item.id}/status`, { isActive });
    return { message: `Listo: "${item.name}" quedó ${isActive ? 'activo' : 'desactivado'}.` };
  },
});
