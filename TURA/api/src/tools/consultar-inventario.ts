import { z } from 'zod';
import type { PosInventoryItem } from './inventory-shared.js';
import { defineReadTool } from './types.js';

interface PosInventoryResult {
  items: PosInventoryItem[];
  count: number;
  total: number;
}

export const consultarInventario = defineReadTool({
  name: 'consultar_inventario',
  description:
    'Busca insumos del inventario de la sede del usuario (papa, carne, vasos, bolsas…) por nombre o SKU y ' +
    'devuelve sus existencias, su unidad, su mínimo y si están por debajo del mínimo o desactivados. ' +
    'Úsala para preguntas sobre insumos y SIEMPRE antes de ajustar existencias o modificar un insumo: ' +
    'te da el "id" exacto que esas herramientas necesitan. Los insumos son distintos de los productos ' +
    'del menú (para esos usa consultar_productos). Si coinciden varios, menciónalos y pregunta cuál.',
  permission: 'inventory.read',
  input: z.object({
    buscar: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .optional()
      .describe('Parte del nombre o del SKU, por ejemplo "papa". Sin este campo lista insumos.'),
    solo_activos: z
      .boolean()
      .optional()
      .describe('true: solo activos. false: solo desactivados. Sin este campo, ambos.'),
    limite: z
      .number()
      .int()
      .min(1)
      .max(30)
      .optional()
      .describe('Cuántos insumos devolver como máximo (por defecto 10, máximo 30).'),
  }),
  async execute({ buscar, solo_activos, limite }, { session }) {
    const { data } = await session.pos.get<PosInventoryResult>('/assistant/inventory', {
      search: buscar,
      isActive: solo_activos,
      limit: limite,
    });
    return {
      total_coincidencias: data.total,
      insumos: data.items.map((item) => ({
        id: item.id,
        nombre: item.name,
        ...(item.sku && { sku: item.sku }),
        existencias: item.currentStock,
        unidad: item.unit,
        minimo: item.minimumStock,
        bajo_el_minimo: item.belowMinimum,
        activo: item.isActive,
      })),
    };
  },
});
