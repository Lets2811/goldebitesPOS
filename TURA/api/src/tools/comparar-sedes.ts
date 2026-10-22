import { z } from 'zod';
import { daysInRange, isCalendarDay, todayInBusinessTimezone } from '../dates.js';
import { PERIODS, resolvePeriod } from './periods.js';
import { defineReadTool, ToolRefusedError } from './types.js';

/** The same limit GET /assistant/branch-comparison enforces, checked here so the refusal comes in Spanish. */
const MAX_RANGE_DAYS = 366;

/** What GET /assistant/branch-comparison answers (see AssistantBranchComparisonService in GB-BE). */
interface PosBranchComparison {
  period: { from: string; to: string };
  branches: {
    name: string;
    isActive: boolean;
    totalSales: number;
    orderCount: number;
    averageTicket: number;
    discountTotal: number;
    expenseTotal: number;
    wasteTotal: number;
    activeOrders: number;
    cashOpen: boolean;
  }[];
}

const day = z.string().refine(isCalendarDay, 'debe ser una fecha real en formato YYYY-MM-DD');

const input = z
  .object({
    periodo: z
      .enum(PERIODS)
      .optional()
      .describe('Un período con nombre (hoy, ayer, esta_semana, este_mes, mes_pasado…). No lo combines con desde/hasta.'),
    desde: day.optional().describe('Primer día del rango (YYYY-MM-DD), junto con hasta.'),
    hasta: day.optional().describe('Último día del rango (YYYY-MM-DD), incluido.'),
  })
  .superRefine((value, context) => {
    const hasRange = value.desde !== undefined || value.hasta !== undefined;
    if (value.periodo && hasRange) {
      context.addIssue({ code: 'custom', message: 'usa periodo o desde/hasta, no ambos' });
    } else if (!value.periodo && !(value.desde && value.hasta)) {
      context.addIssue({ code: 'custom', message: 'indica un periodo, o un rango con desde y hasta' });
    } else if (value.desde && value.hasta && value.desde > value.hasta) {
      context.addIssue({ code: 'custom', message: 'desde no puede ser posterior a hasta' });
    }
  });

export const compararSedes = defineReadTool({
  name: 'comparar_sedes',
  description:
    'Todas las sedes del negocio lado a lado en un período: ventas, número de ventas, ticket promedio, ' +
    'descuentos, gastos y mermas de cada una; y, en este momento, cuántos pedidos tiene en curso y si ' +
    'tiene la caja abierta. Úsala para preguntas que comparan sedes o piden el panorama de todas ' +
    '("cuál sede vendió más", "cómo van las sedes hoy", "qué sede tiene la caja abierta"). Para las ' +
    'cifras de una sola sede, o de todas sumadas, usa consultar_ventas. Los montos están en pesos ' +
    'colombianos y las ventas se cuentan como en consultar_ventas.',
  permission: 'branches.switch',
  input,
  async execute({ periodo, desde, hasta }, { session }) {
    const range = periodo
      ? resolvePeriod(periodo, todayInBusinessTimezone())
      : { desde: desde as string, hasta: hasta as string };
    const days = daysInRange(range.desde, range.hasta);
    if (days > MAX_RANGE_DAYS) {
      throw new ToolRefusedError(
        `El rango pedido cubre ${days} días y el máximo es ${MAX_RANGE_DAYS}. Pide un rango más corto.`,
      );
    }
    const { data } = await session.pos.get<PosBranchComparison>('/assistant/branch-comparison', {
      dateFrom: range.desde,
      dateTo: range.hasta,
    });
    return {
      periodo: { desde: data.period.from, hasta: data.period.to },
      sedes: data.branches.map((branch) => ({
        sede: branch.name,
        ...(!branch.isActive && { inactiva: true }),
        total_vendido: branch.totalSales,
        numero_ventas: branch.orderCount,
        ticket_promedio: branch.averageTicket,
        descuentos: branch.discountTotal,
        gastos: branch.expenseTotal,
        mermas: branch.wasteTotal,
        ahora: { pedidos_en_curso: branch.activeOrders, caja_abierta: branch.cashOpen },
      })),
    };
  },
});
