import { z } from 'zod';
import type { Session } from '../auth.js';
import { assertOwnBranch, atBranch, quantity, readItem, type PosInventoryItem } from './inventory-shared.js';
import { defineWriteTool, ToolRefusedError } from './types.js';

const input = z.object({
  insumo_id: z.uuid().describe('El "id" del insumo, tal como lo devolvió consultar_inventario.'),
  operacion: z
    .enum(['sumar', 'restar', 'fijar'])
    .describe(
      '"sumar": entraron unidades (una compra, una devolución). "restar": salieron (se dañó, se usó). ' +
        '"fijar": el conteo real es exactamente "cantidad" y el POS debe quedar en eso.',
    ),
  cantidad: z
    .number()
    .min(0)
    .max(1_000_000)
    .describe('Para sumar o restar, cuánto; para fijar, cuánto debe quedar. En la unidad del insumo.'),
  motivo: z
    .string()
    .trim()
    .min(3)
    .max(150)
    .describe('Por qué cambia, en palabras del usuario: "compra en plaza", "conteo del cierre", "se dañó".'),
});
type Input = z.infer<typeof input>;

/** How much and which way the stock moves, from what it holds now. */
function plan(item: PosInventoryItem, { operacion, cantidad }: Input) {
  const target =
    operacion === 'sumar'
      ? item.currentStock + cantidad
      : operacion === 'restar'
        ? item.currentStock - cantidad
        : cantidad;
  const delta = Math.round((target - item.currentStock) * 1000) / 1000;
  return { target, delta };
}

async function checked(session: Session, args: Input) {
  const item = await readItem(session, args.insumo_id);
  assertOwnBranch(session, item.branchId, `"${item.name}"`);
  if (args.operacion !== 'fijar' && args.cantidad <= 0) {
    throw new ToolRefusedError('La cantidad a sumar o restar tiene que ser mayor que cero.');
  }
  const { target, delta } = plan(item, args);
  if (target < 0) {
    throw new ToolRefusedError(
      `"${item.name}" tiene ${quantity(item.currentStock, item.unit)}: no se pueden restar ${quantity(args.cantidad, item.unit)}.`,
    );
  }
  if (delta === 0) {
    throw new ToolRefusedError(
      `"${item.name}" ya tiene exactamente ${quantity(item.currentStock, item.unit)}: no hay nada que ajustar.`,
    );
  }
  return { item, target, delta };
}

export const ajustarExistencias = defineWriteTool({
  name: 'ajustar_existencias',
  description:
    'Ajusta las existencias de un insumo del inventario: suma lo que entró, resta lo que salió o lo deja ' +
    'en una cantidad exacta tras un conteo. Primero busca el insumo con consultar_inventario para tener su ' +
    '"id" y sus existencias actuales. Esta herramienta NO hace el cambio: lo deja listo y el usuario lo ' +
    'confirma con un botón en su pantalla. Después de llamarla di en una frase qué va a pasar y pídele que ' +
    'lo confirme; nunca digas que ya quedó hecho.',
  permission: 'inventory.adjust',
  input,
  async prepare(args, { session }) {
    const { item, target } = await checked(session, args);
    const verb =
      args.operacion === 'sumar'
        ? `Sumar ${quantity(args.cantidad, item.unit)} a`
        : args.operacion === 'restar'
          ? `Restar ${quantity(args.cantidad, item.unit)} de`
          : 'Dejar en el conteo real';
    return {
      summary: atBranch(
        session,
        `${verb} "${item.name}": pasa de ${quantity(item.currentStock, item.unit)} a ` +
          `${quantity(target, item.unit)}. Motivo: ${args.motivo}.`,
        item.branchId,
      ),
    };
  },
  async commit(args, { session }) {
    // Read again: what it holds may have changed since it was prepared.
    const { item, delta } = await checked(session, args);
    await session.pos.post('/inventory/adjustments', {
      branchId: item.branchId,
      inventoryItemId: item.id,
      direction: delta > 0 ? 'IN' : 'OUT',
      quantity: Math.abs(delta),
      reason: `${args.motivo} (vía TURA)`,
    });
    const after = await readItem(session, item.id);
    return {
      message:
        `Listo: "${after.name}" quedó en ${quantity(after.currentStock, after.unit)}.` +
        (after.belowMinimum ? ` Sigue por debajo de su mínimo (${quantity(after.minimumStock, after.unit)}).` : ''),
    };
  },
});
