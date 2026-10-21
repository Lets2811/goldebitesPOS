import { z } from 'zod';
import { describeScope, sedeParam, type PosBranchScope } from './branches.js';
import { defineReadTool } from './types.js';

/** `inventory` as GET /assistant/products returns it (see AssistantProductInventory in GB-BE). */
type PosProductInventory =
  | { controlled: false }
  | {
      controlled: true;
      mode: 'DIRECT';
      itemName?: string;
      unit?: string;
      quantityPerUnit?: number;
      currentStock: number | null;
      stockUnavailableReason?: string;
    }
  | { controlled: true; mode: 'RECIPE'; ingredientCount: number; currentStock: null }
  | { controlled: true; mode: 'UNLINKED'; currentStock: null };

interface PosProduct {
  id: string;
  name: string;
  description: string | null;
  sku: string | null;
  salePrice: number;
  isActive: boolean;
  isVisible: boolean;
  inventory: PosProductInventory;
  /** The product's branch, when the answer covers several. */
  branch?: string;
  /** At its branch: whether it is offered and whether it ran out. */
  atBranch?: { offered: boolean; soldOut: boolean };
}

interface PosProductsResult {
  items: PosProduct[];
  count: number;
  total: number;
  scope?: PosBranchScope;
}

/** Why a product sold straight from one inventory item has no stock figure, in words the model can pass on. */
const NO_STOCK_REASONS: Record<string, string> = {
  NO_INVENTORY_ACCESS: 'el usuario no tiene permiso para ver inventario',
  INVENTORY_ITEM_UNAVAILABLE: 'el artículo de inventario vinculado fue eliminado o desactivado',
};

function describeInventory(inventory: PosProductInventory) {
  if (!inventory.controlled) {
    return { controla_inventario: false };
  }
  if (inventory.mode === 'DIRECT') {
    return inventory.currentStock === null
      ? {
          controla_inventario: true,
          existencias: null,
          motivo_sin_existencias:
            NO_STOCK_REASONS[inventory.stockUnavailableReason ?? ''] ?? 'no disponible',
        }
      : {
          controla_inventario: true,
          existencias: inventory.currentStock,
          unidad: inventory.unit,
          // Only worth the tokens when one sale does not take exactly one unit.
          ...(inventory.quantityPerUnit !== 1 && {
            consumo_por_venta: inventory.quantityPerUnit,
          }),
        };
  }
  return {
    controla_inventario: true,
    existencias: null,
    motivo_sin_existencias:
      inventory.mode === 'RECIPE'
        ? `se prepara con una receta de ${inventory.ingredientCount} ingredientes; el POS no calcula cuántas unidades se pueden preparar`
        : 'está marcado para controlar inventario pero no tiene receta, así que el POS no le descuenta existencias',
  };
}

export const consultarProductos = defineReadTool({
  name: 'consultar_productos',
  description:
    'Busca productos del menú del POS por nombre o SKU y devuelve su precio de venta, si están ' +
    'activos y visibles en el menú, y sus existencias. Úsala para preguntas sobre un producto: ' +
    'si existe, cuánto cuesta, cuántas unidades quedan o si está disponible. Devuelve el "id" que ' +
    'modificar_producto necesita. ' +
    'Las existencias solo se informan para productos que se venden tal cual desde un artículo de ' +
    'inventario (una botella de agua, una gaseosa); para los demás "existencias" es null y ' +
    '"motivo_sin_existencias" explica por qué — eso NO significa que haya cero. ' +
    'Un producto con "controla_inventario" en false no maneja existencias. ' +
    'Si la búsqueda coincide con varios productos los devuelve todos: no elijas uno por tu cuenta, ' +
    'menciona las coincidencias. "total_coincidencias" puede ser mayor que los productos devueltos. ' +
    'Para saber qué productos tienen menos o más existencias ("qué se está acabando", "el de stock más ' +
    'bajo", "de qué hay más") usa "ordenar_por_existencias": el POS ordena todo el catálogo, así que una ' +
    'sola llamada basta y no hace falta buscar por partes. Con ese orden solo se incluyen los productos ' +
    'que tienen existencias conocidas, y varios pueden empatar en el primer lugar: menciónalos todos. ' +
    'Cada sede tiene su propio catálogo: si el resultado cubre varias sedes, cada producto dice de cuál es, ' +
    'y un mismo producto puede aparecer una vez por sede con su precio y existencias de esa sede. ' +
    '"agotado" en true significa que a su sede le falta algún ingrediente: no se puede pedir.',
  permission: 'products.read',
  input: z.object({
    buscar: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .optional()
      .describe(
        'Parte del nombre o del SKU del producto, por ejemplo "agua". Sin este campo lista productos del menú.',
      ),
    solo_activos: z
      .boolean()
      .optional()
      .describe('true: solo productos activos. false: solo los desactivados. Sin este campo, ambos.'),
    solo_visibles: z
      .boolean()
      .optional()
      .describe(
        'true: solo los visibles en el menú para clientes. false: solo los ocultos. Sin este campo, ambos.',
      ),
    ordenar_por_existencias: z
      .enum(['menor', 'mayor'])
      .optional()
      .describe(
        '"menor": primero los que tienen menos existencias. "mayor": primero los que tienen más. ' +
          'Sin este campo los productos van en orden alfabético.',
      ),
    limite: z
      .number()
      .int()
      .min(1)
      .max(20)
      .optional()
      .describe('Cuántos productos devolver como máximo (por defecto 10, máximo 20).'),
    sede: sedeParam,
  }),
  async execute(
    { buscar, solo_activos, solo_visibles, ordenar_por_existencias, limite, sede },
    { session },
  ) {
    const { data } = await session.pos.get<PosProductsResult>('/assistant/products', {
      search: buscar,
      isActive: solo_activos,
      isVisible: solo_visibles,
      limit: limite,
      branch: sede,
      ...(ordenar_por_existencias && {
        sortBy: 'stock',
        sortOrder: ordenar_por_existencias === 'menor' ? 'asc' : 'desc',
      }),
    });
    return {
      ...describeScope(data.scope),
      total_coincidencias: data.total,
      productos: data.items.map((product) => ({
        id: product.id,
        nombre: product.name,
        ...(product.branch && { sede: product.branch }),
        ...(product.atBranch?.soldOut && { agotado: true }),
        ...(product.description && { descripcion: product.description }),
        ...(product.sku && { sku: product.sku }),
        precio: product.salePrice,
        activo: product.isActive,
        visible_en_menu: product.isVisible,
        ...describeInventory(product.inventory),
      })),
    };
  },
});
