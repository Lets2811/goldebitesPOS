import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import type { Session } from '../auth.js';
import { dayBoundary } from '../dates.js';
import { PosApiError } from '../pos/pos-client.js';

const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .describe('Día calendario del negocio en formato YYYY-MM-DD');

const ORDER_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'PREPARING',
  'READY',
  'DELIVERED',
  'CANCELLED',
] as const;

const ORDER_TYPES = ['DINE_IN', 'TAKEAWAY', 'DELIVERY', 'CAR_SERVICE'] as const;

/** The subset of GB-BE's Order that is worth spending tokens on. */
interface PosOrder {
  orderNumber: string;
  orderType: string;
  status: string;
  paymentStatus: string;
  customerName: string | null;
  tableNumber: string | null;
  totalAmount: number;
  createdAt: string;
}

/**
 * Runs a POS read and serializes it for the model. A POS rejection (no
 * permission, module disabled, bad filter) is returned as text rather than
 * thrown, so TURA can explain it to the user instead of the turn failing.
 */
async function read(query: () => Promise<unknown>): Promise<string> {
  try {
    return JSON.stringify(await query());
  } catch (error) {
    if (error instanceof PosApiError) {
      return `El POS rechazó la consulta (${error.status}): ${error.message}`;
    }
    throw error;
  }
}

/**
 * The tools offered in one conversation, already bound to the caller's POS
 * session. Tools the caller has no permission for are left out so TURA never
 * promises something GB-BE would refuse; GB-BE still checks every call.
 */
export function buildTools(session: Session) {
  const { pos } = session;

  const catalog = [
    {
      permission: 'dashboard.read',
      tool: betaZodTool({
        name: 'resumen_del_dia',
        description:
          'Resumen de hoy: ventas (número de pedidos, total y ticket promedio), pedidos activos, ' +
          'cantidad de productos con stock bajo y si la caja está abierta. Úsala para preguntas ' +
          'generales como "¿cómo va el día?". Solo cubre el día de hoy.',
        inputSchema: z.object({}),
        run: () =>
          read(async () => {
            const { data } = await pos.get('/dashboard/summary', {
              branchId: session.branchId ?? undefined,
            });
            return data;
          }),
      }),
    },
    {
      permission: 'analytics.read',
      tool: betaZodTool({
        name: 'consultar_ventas',
        description:
          'Ventas de un rango de días (ambos incluidos): total y número de pedidos por día, y los ' +
          'productos más vendidos del rango. Solo cuenta pedidos entregados. Para un solo día usa ' +
          'la misma fecha en desde y hasta.',
        inputSchema: z.object({
          desde: day,
          hasta: day,
          top_productos: z
            .number()
            .int()
            .min(1)
            .max(20)
            .optional()
            .describe('Cuántos productos más vendidos incluir (por defecto 5)'),
        }),
        run: ({ desde, hasta, top_productos }) =>
          read(async () => {
            const range = {
              dateFrom: dayBoundary(desde, 'start'),
              dateTo: dayBoundary(hasta, 'end'),
            };
            const [sales, topProducts] = await Promise.all([
              pos.get('/analytics/sales', range),
              pos.get('/analytics/top-products', {
                ...range,
                limit: top_productos ?? 5,
              }),
            ]);
            return {
              ventasPorDia: sales.data,
              productosMasVendidos: topProducts.data,
            };
          }),
      }),
    },
    {
      permission: 'orders.read',
      tool: betaZodTool({
        name: 'listar_pedidos',
        description:
          'Lista pedidos, del más reciente al más antiguo, con filtros opcionales por estado, tipo, ' +
          'rango de días o texto de búsqueda. Devuelve como máximo 20 pedidos y el total de ' +
          'coincidencias.',
        inputSchema: z.object({
          estado: z.enum(ORDER_STATUSES).optional(),
          tipo: z.enum(ORDER_TYPES).optional(),
          desde: day.optional(),
          hasta: day.optional(),
          buscar: z
            .string()
            .optional()
            .describe('Texto a buscar, por ejemplo el número de pedido o el cliente'),
        }),
        run: ({ estado, tipo, desde, hasta, buscar }) =>
          read(async () => {
            const { data, meta } = await pos.get<PosOrder[]>('/orders', {
              status: estado,
              orderType: tipo,
              dateFrom: desde && dayBoundary(desde, 'start'),
              dateTo: hasta && dayBoundary(hasta, 'end'),
              search: buscar,
              limit: 20,
            });
            return {
              totalCoincidencias: meta?.total,
              pedidos: data.map((order) => ({
                numero: order.orderNumber,
                tipo: order.orderType,
                estado: order.status,
                pago: order.paymentStatus,
                cliente: order.customerName,
                mesa: order.tableNumber,
                total: order.totalAmount,
                creado: order.createdAt,
              })),
            };
          }),
      }),
    },
    {
      permission: 'inventory.read',
      tool: betaZodTool({
        name: 'consultar_stock_bajo',
        description:
          'Insumos del inventario que están por debajo de su stock mínimo, con su existencia ' +
          'actual, su mínimo y su unidad.',
        inputSchema: z.object({}),
        run: () =>
          read(async () => {
            const { data } = await pos.get('/inventory/low-stock', {
              branchId: session.branchId ?? undefined,
            });
            return data;
          }),
      }),
    },
  ];

  return catalog
    .filter(({ permission }) => session.permissions.includes(permission))
    .map(({ tool }) => tool);
}
