import { z } from 'zod';
import { daysInRange, isCalendarDay, todayInBusinessTimezone } from '../dates.js';
import { PERIODS, resolvePeriod } from './periods.js';
import { describeScope, sedeParam } from './branches.js';
import { defineReadTool, ToolRefusedError } from './types.js';

/** The same limits GET /assistant/sales enforces, checked here first so the refusal comes in the user's language. */
const MAX_RANGE_DAYS = 366;
const MAX_DAILY_RANGE_DAYS = 31;

const GROUP_BY = { dia: 'day', semana: 'week', mes: 'month' } as const;
const PRODUCT_ORDER = { cantidad: 'quantity', ingresos: 'revenue' } as const;

interface PosFigures {
  totalSales: number;
  orderCount: number;
}

/** What GET /assistant/sales answers (see AssistantSalesResult in GB-BE). */
interface PosSales {
  period: { from: string; to: string };
  scope: { branch: string | null; branches?: string[] };
  summary: PosFigures & { averageTicket: number };
  breakdown?: { groupBy: string; items: (PosFigures & { from: string; to: string })[] };
  topProducts?: { orderedBy: string; items: { name: string; quantitySold: number; revenue: number }[] };
}

const day = z
  .string()
  .refine(isCalendarDay, 'debe ser una fecha real en formato YYYY-MM-DD');

const input = z
  .object({
    periodo: z
      .enum(PERIODS)
      .optional()
      .describe(
        'Un período con nombre; el sistema calcula sus fechas exactas. Úsalo siempre que la pregunta ' +
          'coincida con uno: hoy, ayer, esta_semana (lunes a hoy), semana_pasada (lunes a domingo), ' +
          'este_fin_de_semana, fin_de_semana_pasado, este_mes (día 1 a hoy), mes_pasado (el mes ' +
          'calendario anterior completo), este_anio, anio_pasado, ultimos_7_dias, ultimos_30_dias. ' +
          'No lo combines con desde/hasta.',
      ),
    desde: day
      .optional()
      .describe(
        'Primer día del rango (YYYY-MM-DD), para lo que no es un período con nombre: un mes nombrado ' +
          '("enero" es 01-01 a 01-31), un rango explícito ("del 1 al 15 de septiembre") o un período ' +
          'equivalente para comparar. Va siempre junto con hasta.',
      ),
    hasta: day.optional().describe('Último día del rango (YYYY-MM-DD), incluido.'),
    agrupar_por: z
      .enum(['dia', 'semana', 'mes'])
      .optional()
      .describe(
        'Añade el detalle por día, por semana (lunes a domingo) o por mes. Úsalo cuando pregunten por ' +
          'la evolución, o por el mejor o el peor día, semana o mes. Por día admite como máximo 31 días.',
      ),
    incluir_productos_mas_vendidos: z
      .boolean()
      .optional()
      .describe('true para incluir los productos más vendidos del período.'),
    orden_productos: z
      .enum(['cantidad', 'ingresos'])
      .optional()
      .describe(
        '"cantidad": los que más unidades vendieron (lo habitual cuando preguntan por "lo más vendido"). ' +
          '"ingresos": los que más dinero generaron. Por defecto, cantidad.',
      ),
    limite_productos: z
      .number()
      .int()
      .min(1)
      .max(10)
      .optional()
      .describe('Cuántos productos incluir (por defecto 5, máximo 10).'),
    sede: sedeParam,
  })
  .superRefine((value, context) => {
    const hasRange = value.desde !== undefined || value.hasta !== undefined;
    if (value.periodo && hasRange) {
      context.addIssue({ code: 'custom', message: 'usa periodo o desde/hasta, no ambos' });
    } else if (!value.periodo && !(value.desde && value.hasta)) {
      context.addIssue({
        code: 'custom',
        message: 'indica un periodo, o un rango con desde y hasta',
      });
    } else if (value.desde && value.hasta && value.desde > value.hasta) {
      context.addIssue({ code: 'custom', message: 'desde no puede ser posterior a hasta' });
    }
  });

export const consultarVentas = defineReadTool({
  name: 'consultar_ventas',
  description:
    'Ventas del negocio en un período: total vendido, número de ventas y ticket promedio; y, si se ' +
    'pide, el detalle por día, semana o mes y los productos más vendidos. Úsala para cualquier ' +
    'pregunta sobre cuánto se vendió, cuántas ventas hubo, cómo va o cómo fue un período, cuál fue el ' +
    'mejor día, o qué fue lo más vendido. ' +
    'Una venta es un pedido pagado por completo, contado el día en que se terminó de pagar, esté o no ' +
    'entregado todavía. No cuentan los pedidos sin pagar, los pagados solo en parte ni los cancelados: ' +
    'si un pedido reciente no aparece en la cifra, lo más probable es que aún no esté pagado del todo. ' +
    'Los montos están en pesos colombianos. ' +
    'Fechas: usa "periodo" cuando la pregunta nombre uno; para todo lo demás calcula tú el rango y ' +
    'pásalo en "desde" y "hasta". Un mes nombrado sin año ("enero") es el más reciente que no esté en ' +
    'el futuro; si es el mes en curso, llega hasta hoy. El resultado trae el rango exacto consultado: ' +
    'menciónalo cuando el período no sea evidente. Un rango no puede pasar de 366 días. ' +
    'Comparaciones: llama la herramienta una vez por cada período y compara tú los resultados. Si ' +
    'preguntan "cómo vamos" frente a un período anterior y el actual no ha terminado, compara tramos ' +
    'equivalentes (por ejemplo, lunes a hoy contra lunes al mismo día de la semana pasada, con ' +
    'desde/hasta). Si piden comparar dos períodos sin más, usa cada uno como es y aclara que el actual ' +
    'está incompleto. ' +
    'Sedes: en un negocio con varias, las cifras cubren todas las que el usuario puede ver salvo que ' +
    'nombre una. Si el resultado trae "alcance", di si la cifra es de todas o de una; si no lo trae, no ' +
    'hay que mencionar sedes. Para comparar sedes entre sí usa comparar_sedes, no esta.',
  permission: 'analytics.read',
  input,
  async execute(
    { periodo, desde, hasta, agrupar_por, incluir_productos_mas_vendidos, orden_productos, limite_productos, sede },
    { session },
  ) {
    // The schema guarantees one of the two forms.
    const range = periodo
      ? resolvePeriod(periodo, todayInBusinessTimezone())
      : { desde: desde as string, hasta: hasta as string };

    const days = daysInRange(range.desde, range.hasta);
    if (days > MAX_RANGE_DAYS) {
      throw new ToolRefusedError(
        `El rango pedido cubre ${days} días y el máximo es ${MAX_RANGE_DAYS}. Pide un rango más corto, o divídelo en varias consultas.`,
      );
    }
    if (agrupar_por === 'dia' && days > MAX_DAILY_RANGE_DAYS) {
      throw new ToolRefusedError(
        `El detalle por día admite como máximo ${MAX_DAILY_RANGE_DAYS} días (se pidieron ${days}). Agrupa por semana o por mes, o acorta el rango.`,
      );
    }

    const withProducts = incluir_productos_mas_vendidos === true;
    const { data } = await session.pos.get<PosSales>('/assistant/sales', {
      dateFrom: range.desde,
      dateTo: range.hasta,
      groupBy: agrupar_por && GROUP_BY[agrupar_por],
      includeTopProducts: withProducts || undefined,
      topProductsLimit: withProducts ? limite_productos : undefined,
      topProductsOrder: withProducts && orden_productos ? PRODUCT_ORDER[orden_productos] : undefined,
      branch: sede,
    });

    return {
      periodo: { desde: data.period.from, hasta: data.period.to },
      // Only a business with several branches has a scope worth mentioning.
      ...describeScope(data.scope),
      resumen: {
        total_vendido: data.summary.totalSales,
        numero_ventas: data.summary.orderCount,
        ticket_promedio: data.summary.averageTicket,
      },
      ...(data.breakdown && {
        // Periods without sales are not listed.
        detalle: data.breakdown.items.map((item) => ({
          ...(item.from === item.to ? { dia: item.from } : { desde: item.from, hasta: item.to }),
          total_vendido: item.totalSales,
          numero_ventas: item.orderCount,
        })),
      }),
      ...(data.topProducts && {
        productos_mas_vendidos: {
          ordenados_por: data.topProducts.orderedBy === 'revenue' ? 'ingresos' : 'cantidad',
          productos: data.topProducts.items.map((product) => ({
            nombre: product.name,
            cantidad_vendida: product.quantitySold,
            ingresos: product.revenue,
          })),
        },
      }),
    };
  },
});
