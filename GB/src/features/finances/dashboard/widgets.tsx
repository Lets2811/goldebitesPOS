import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Pencil, Trash2 } from 'lucide-react';
import type { Expense } from '../../../modules/finances/types/expense.types';
import type { WidgetPlacement } from '../../../store/financeDashboardStore';
import { brand, chartAxis, chartCategorical, chartGrid } from '../../../theme/palette';
import { formatCOP, formatDateCO, formatNumber, formatPercent } from '../../../utils/format';
import type { FinanceData } from './use-finance-data';

/** Lo que un widget recibe para dibujarse. */
export interface WidgetContext {
  data: FinanceData;
  /** Nombre del tipo de un gasto. */
  categoryLabel: (code: string) => string;
  /** Presentes solo para quien puede administrar gastos. */
  onEditExpense?: (expense: Expense) => void;
  onDeleteExpense?: (expense: Expense) => void;
}

export interface WidgetDefinition {
  id: string;
  title: string;
  /** Qué muestra, para el menú de "Agregar widget". */
  description: string;
  /** Tamaño al agregarlo y el mínimo al que se puede encoger, en columnas y filas de la cuadrícula. */
  size: { w: number; h: number; minW: number; minH: number };
  render: (context: WidgetContext) => ReactNode;
}

function Figure({ value, helper, tone }: { value: string; helper?: string; tone?: 'positive' | 'negative' }) {
  return (
    <Stack sx={{ justifyContent: 'center', height: '100%', minWidth: 0 }}>
      <Typography
        noWrap
        sx={{
          fontWeight: 800,
          lineHeight: 1.15,
          // Se adapta al ancho del widget en vez de recortarse.
          fontSize: 'clamp(1.1rem, 2.2cqw + 0.9rem, 2rem)',
          color: tone === 'negative' ? 'error.main' : tone === 'positive' ? 'success.main' : 'text.primary',
        }}
      >
        {value}
      </Typography>
      {helper && (
        <Typography variant="caption" color="text.secondary" noWrap>
          {helper}
        </Typography>
      )}
    </Stack>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <Stack sx={{ height: '100%', alignItems: 'center', justifyContent: 'center', textAlign: 'center', px: 2 }}>
      <Typography variant="body2" color="text.secondary">
        {children}
      </Typography>
    </Stack>
  );
}

const share = (part: number, whole: number) => (whole > 0 ? formatPercent(part / whole) : undefined);

/** Todos los widgets que el panel de Finanzas puede mostrar. */
export const WIDGETS: WidgetDefinition[] = [
  {
    id: 'sales',
    title: 'Ventas',
    description: 'Total de los pedidos pagados en el período.',
    size: { w: 3, h: 2, minW: 2, minH: 2 },
    render: ({ data }) => (
      <Figure
        value={formatCOP(data.sales)}
        helper={`${formatNumber(data.salesCount)} ${data.salesCount === 1 ? 'venta' : 'ventas'}`}
      />
    ),
  },
  {
    id: 'expenses',
    title: 'Gastos',
    description: 'Todo lo gastado en el período.',
    size: { w: 3, h: 2, minW: 2, minH: 2 },
    render: ({ data }) => (
      <Figure
        value={formatCOP(data.expenses)}
        helper={data.sales > 0 ? `${share(data.expenses, data.sales)} de las ventas` : undefined}
      />
    ),
  },
  {
    id: 'profit',
    title: 'Utilidad estimada',
    description: 'Ventas menos todos los gastos.',
    size: { w: 3, h: 2, minW: 2, minH: 2 },
    render: ({ data }) => (
      <Figure
        value={formatCOP(data.profit)}
        tone={data.profit < 0 ? 'negative' : data.profit > 0 ? 'positive' : undefined}
        helper={data.sales > 0 ? `${share(data.profit, data.sales)} de las ventas` : undefined}
      />
    ),
  },
  {
    id: 'grossMargin',
    title: 'Margen bruto',
    description: 'Ventas menos el costo de ventas.',
    size: { w: 3, h: 2, minW: 2, minH: 2 },
    render: ({ data }) => (
      <Figure
        value={formatCOP(data.grossMargin)}
        tone={data.grossMargin < 0 ? 'negative' : undefined}
        helper={data.sales > 0 ? `${share(data.grossMargin, data.sales)} de las ventas` : undefined}
      />
    ),
  },
  {
    id: 'costOfSales',
    title: 'Costo de ventas',
    description: 'Gastos de los tipos marcados como costo de ventas.',
    size: { w: 3, h: 2, minW: 2, minH: 2 },
    render: ({ data }) => (
      <Figure
        value={formatCOP(data.costOfSales)}
        helper={data.sales > 0 ? `${share(data.costOfSales, data.sales)} de las ventas` : undefined}
      />
    ),
  },
  {
    id: 'averageTicket',
    title: 'Ticket promedio',
    description: 'Lo que deja cada venta en promedio.',
    size: { w: 3, h: 2, minW: 2, minH: 2 },
    render: ({ data }) => (
      <Figure value={formatCOP(Math.round(data.averageTicket))} helper={`en ${formatNumber(data.salesCount)} ventas`} />
    ),
  },
  {
    id: 'timeline',
    title: 'Ventas y gastos en el tiempo',
    description: 'Gráfica de ventas contra gastos, día a día o mes a mes.',
    size: { w: 8, h: 5, minW: 4, minH: 4 },
    render: ({ data }) =>
      data.sales === 0 && data.expenses === 0 ? (
        <Empty>No hay ventas ni gastos en este período.</Empty>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.timeline} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={chartGrid} />
            <XAxis
              dataKey="label"
              tick={{ fill: chartAxis, fontSize: 11 }}
              axisLine={{ stroke: chartGrid }}
              tickLine={false}
              minTickGap={12}
            />
            <YAxis
              tick={{ fill: chartAxis, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={48}
              tickFormatter={(value: number) =>
                value >= 1_000_000 ? `${(value / 1_000_000).toFixed(1)}M` : `${Math.round(value / 1000)}k`
              }
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#1A1A1D', border: '1px solid #2A2A2E', borderRadius: 8 }}
              formatter={(value) => formatCOP(Number(value))}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="ventas" name="Ventas" fill={brand.gold} radius={[4, 4, 0, 0]} maxBarSize={28} />
            <Bar dataKey="gastos" name="Gastos" fill={chartCategorical[1]} radius={[4, 4, 0, 0]} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      ),
  },
  {
    id: 'byCategory',
    title: 'Gastos por tipo',
    description: 'En qué se fue el dinero, de mayor a menor.',
    size: { w: 4, h: 5, minW: 3, minH: 3 },
    render: ({ data }) =>
      data.byCategory.length === 0 ? (
        <Empty>No hay gastos en este período.</Empty>
      ) : (
        <Stack spacing={1.5}>
          {data.byCategory.map((category) => (
            <Box key={category.code}>
              <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 1 }}>
                <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
                  {category.name}
                </Typography>
                <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>
                  {formatCOP(category.total)}{' '}
                  <Typography component="span" variant="caption" color="text.secondary">
                    {share(category.total, data.expenses)}
                  </Typography>
                </Typography>
              </Stack>
              <LinearProgress
                variant="determinate"
                value={data.expenses > 0 ? (category.total / data.expenses) * 100 : 0}
                sx={{ mt: 0.5, height: 6, borderRadius: 3 }}
              />
            </Box>
          ))}
        </Stack>
      ),
  },
  {
    id: 'expensesTable',
    title: 'Gastos registrados',
    description: 'La lista de gastos del período, para revisarlos o corregirlos.',
    size: { w: 8, h: 6, minW: 4, minH: 3 },
    render: ({ data, categoryLabel, onEditExpense, onDeleteExpense }) =>
      data.expenseList.length === 0 ? (
        <Empty>No hay gastos registrados en este período.</Empty>
      ) : (
        <Stack divider={<Box sx={{ borderTop: '1px solid', borderColor: 'divider' }} />}>
          {data.expenseList.map((expense) => (
            <Stack
              key={expense.id}
              direction="row"
              spacing={1.5}
              sx={{ alignItems: 'center', py: 1, minWidth: 0 }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
                  {expense.name ?? expense.description}
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                  {formatDateCO(expense.expenseDate)} · {categoryLabel(expense.category)}
                  {expense.responsible ? ` · ${expense.responsible}` : ''}
                </Typography>
              </Box>
              <Typography variant="body2" sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                {formatCOP(expense.amount)}
              </Typography>
              {onEditExpense && (
                <IconButton size="small" aria-label="Editar gasto" onClick={() => onEditExpense(expense)}>
                  <Pencil size={14} />
                </IconButton>
              )}
              {onDeleteExpense && (
                <IconButton size="small" aria-label="Eliminar gasto" onClick={() => onDeleteExpense(expense)}>
                  <Trash2 size={14} />
                </IconButton>
              )}
            </Stack>
          ))}
          {data.expenseCount > data.expenseList.length && (
            <Typography variant="caption" color="text.secondary" sx={{ py: 1 }}>
              Se muestran los {data.expenseList.length} más recientes de {data.expenseCount}. Acorta el período para ver
              los demás.
            </Typography>
          )}
        </Stack>
      ),
  },
  {
    id: 'topProducts',
    title: 'Productos que más ingresos dejaron',
    description: 'Los productos con más ventas en dinero.',
    size: { w: 4, h: 6, minW: 3, minH: 3 },
    render: ({ data }) =>
      data.topProducts.length === 0 ? (
        <Empty>No hay ventas en este período.</Empty>
      ) : (
        <Stack divider={<Box sx={{ borderTop: '1px solid', borderColor: 'divider' }} />}>
          {data.topProducts.map((product, index) => (
            <Stack key={product.productId ?? product.productName} direction="row" spacing={1.5} sx={{ py: 1 }}>
              <Typography variant="body2" color="text.secondary" sx={{ width: 18 }}>
                {index + 1}
              </Typography>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
                  {product.productName}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {formatNumber(product.quantitySold)} unidades
                </Typography>
              </Box>
              <Typography variant="body2" sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                {formatCOP(product.revenue)}
              </Typography>
            </Stack>
          ))}
        </Stack>
      ),
  },
];

export const WIDGETS_BY_ID = new Map(WIDGETS.map((widget) => [widget.id, widget]));

/** El panel con el que empieza cada persona. */
export const DEFAULT_LAYOUT: WidgetPlacement[] = [
  { i: 'sales', x: 0, y: 0, w: 3, h: 2 },
  { i: 'expenses', x: 3, y: 0, w: 3, h: 2 },
  { i: 'profit', x: 6, y: 0, w: 3, h: 2 },
  { i: 'grossMargin', x: 9, y: 0, w: 3, h: 2 },
  { i: 'timeline', x: 0, y: 2, w: 8, h: 5 },
  { i: 'byCategory', x: 8, y: 2, w: 4, h: 5 },
  { i: 'expensesTable', x: 0, y: 7, w: 8, h: 6 },
  { i: 'topProducts', x: 8, y: 7, w: 4, h: 6 },
];
