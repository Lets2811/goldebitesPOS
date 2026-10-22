import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import ErrorState from '../../../components/common/ErrorState';
import LoadingSkeleton from '../../../components/common/LoadingSkeleton';
import PageHeader from '../../../components/common/PageHeader';
import StatusChip from '../../../components/common/StatusChip';
import {
  useBranchComparison,
  type BranchFigures,
} from '../../../modules/branch-comparison/branch-comparison';
import { brand, chartAxis, chartGrid } from '../../../theme/palette';
import { formatCOP } from '../../../utils/format';

type Preset = 'today' | 'week' | 'month' | 'custom';

/** One color per branch, in order; the first is the brand's. */
const BRANCH_COLORS = [
  brand.gold,
  '#4FC3F7',
  '#81C784',
  '#BA68C8',
  '#FF8A65',
  '#F06292',
  '#A1887F',
  '#90A4AE',
];

const pad = (n: number) => String(n).padStart(2, '0');
const toDateInput = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

function presetDays(preset: Exclude<Preset, 'custom'>): { from: string; to: string } {
  const today = new Date();
  const from = new Date(today);
  if (preset === 'week') from.setDate(from.getDate() - 6);
  if (preset === 'month') from.setDate(1);
  return { from: toDateInput(from), to: toDateInput(today) };
}

/** A metric of the table: how to read it and whether more is better. */
interface Metric {
  key: keyof BranchFigures;
  label: string;
  format: (value: number) => string;
  /** Highlight the highest (true), the lowest (false), or neither (null). */
  higherIsBetter: boolean | null;
}

const METRICS: Metric[] = [
  { key: 'salesTotal', label: 'Ventas', format: formatCOP, higherIsBetter: true },
  { key: 'orderCount', label: 'Pedidos', format: (v) => String(v), higherIsBetter: true },
  { key: 'averageTicket', label: 'Ticket promedio', format: formatCOP, higherIsBetter: true },
  { key: 'discountTotal', label: 'Descuentos', format: formatCOP, higherIsBetter: null },
  { key: 'expenseTotal', label: 'Gastos', format: formatCOP, higherIsBetter: false },
  { key: 'wasteTotal', label: 'Mermas', format: formatCOP, higherIsBetter: false },
];

/**
 * Every branch side by side for a range: what each sold, its ticket, the
 * discounts it gave, what it spent and wasted, and how it is right now.
 */
export default function BranchComparisonPage() {
  const [preset, setPreset] = useState<Preset>('week');
  const [custom, setCustom] = useState(() => presetDays('week'));
  const days = preset === 'custom' ? custom : presetDays(preset);
  const validRange = days.from !== '' && days.to !== '' && days.from <= days.to;

  const range = useMemo(
    () => ({
      dateFrom: new Date(`${days.from}T00:00:00`).toISOString(),
      dateTo: new Date(`${days.to}T23:59:59`).toISOString(),
    }),
    [days.from, days.to],
  );
  const { data, isLoading, isError, refetch } = useBranchComparison(range, validRange);
  const branches = useMemo(() => data?.branches ?? [], [data]);

  const colorOf = (branchId: string) =>
    BRANCH_COLORS[branches.findIndex((b) => b.branchId === branchId) % BRANCH_COLORS.length];

  /** Best and worst branch for each metric, when there is something to compare. */
  const extremes = useMemo(() => {
    const result = new Map<string, { best?: string; worst?: string }>();
    if (branches.length < 2) return result;
    for (const metric of METRICS) {
      if (metric.higherIsBetter === null) continue;
      const values = branches.map((b) => b[metric.key] as number);
      if (values.every((v) => v === values[0])) continue;
      const max = branches[values.indexOf(Math.max(...values))].branchId;
      const min = branches[values.indexOf(Math.min(...values))].branchId;
      result.set(
        metric.key,
        metric.higherIsBetter ? { best: max, worst: min } : { best: min, worst: max },
      );
    }
    return result;
  }, [branches]);

  const totals = useMemo(() => {
    const sales = branches.reduce((sum, b) => sum + b.salesTotal, 0);
    const orders = branches.reduce((sum, b) => sum + b.orderCount, 0);
    return {
      salesTotal: sales,
      orderCount: orders,
      averageTicket: orders > 0 ? Math.round((sales / orders) * 100) / 100 : 0,
      discountTotal: branches.reduce((sum, b) => sum + b.discountTotal, 0),
      expenseTotal: branches.reduce((sum, b) => sum + b.expenseTotal, 0),
      wasteTotal: branches.reduce((sum, b) => sum + b.wasteTotal, 0),
    } as Record<string, number>;
  }, [branches]);

  const chartData = useMemo(
    () =>
      (data?.daily ?? []).map((day) => ({
        label: new Date(`${day.date}T12:00:00`).toLocaleDateString('es-CO', {
          day: 'numeric',
          month: 'short',
        }),
        ...day.sales,
      })),
    [data],
  );

  return (
    <>
      <PageHeader
        title="Comparativo de sedes"
        subtitle="Cada sede lado a lado: ventas, ticket, descuentos, gastos y mermas del período."
        breadcrumbs={[{ label: 'Gestión del negocio' }, { label: 'Comparativo de sedes' }]}
      />

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        sx={{ mb: 2.5, alignItems: { sm: 'center' }, flexWrap: 'wrap', rowGap: 1.5 }}
      >
        <ToggleButtonGroup
          exclusive
          size="small"
          value={preset}
          onChange={(_e, value: Preset | null) => value && setPreset(value)}
        >
          <ToggleButton value="today">Hoy</ToggleButton>
          <ToggleButton value="week">7 días</ToggleButton>
          <ToggleButton value="month">Este mes</ToggleButton>
          <ToggleButton value="custom">Personalizado</ToggleButton>
        </ToggleButtonGroup>
        {preset === 'custom' && (
          <Stack direction="row" spacing={1}>
            <TextField
              size="small"
              type="date"
              label="Desde"
              value={custom.from}
              onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              size="small"
              type="date"
              label="Hasta"
              value={custom.to}
              onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))}
              error={!validRange}
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Stack>
        )}
      </Stack>

      {isLoading ? (
        <LoadingSkeleton variant="page" />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : (
        <Stack spacing={2.5}>
          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
            <Table size="small" sx={{ minWidth: 820 }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Sede</TableCell>
                  {METRICS.map((metric) => (
                    <TableCell key={metric.key} align="right" sx={{ fontWeight: 700 }}>
                      {metric.label}
                    </TableCell>
                  ))}
                  <TableCell align="right" sx={{ fontWeight: 700 }}>
                    Ahora
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {branches.map((branch) => (
                  <TableRow key={branch.branchId} hover>
                    <TableCell>
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                        <Box
                          sx={{
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            bgcolor: colorOf(branch.branchId),
                          }}
                        />
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {branch.name}
                        </Typography>
                        {!branch.isActive && <StatusChip label="Inactiva" tone="neutral" />}
                      </Stack>
                    </TableCell>
                    {METRICS.map((metric) => {
                      const mark = extremes.get(metric.key);
                      const isBest = mark?.best === branch.branchId;
                      const isWorst = mark?.worst === branch.branchId;
                      return (
                        <TableCell
                          key={metric.key}
                          align="right"
                          sx={{
                            fontWeight: isBest ? 800 : undefined,
                            color: isBest ? 'success.main' : isWorst ? 'error.main' : undefined,
                            bgcolor: isBest
                              ? (t) => alpha(t.palette.success.main, 0.08)
                              : undefined,
                          }}
                        >
                          {metric.format(branch[metric.key] as number)}
                        </TableCell>
                      );
                    })}
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.75} sx={{ justifyContent: 'flex-end' }}>
                        <StatusChip
                          label={branch.cashOpen ? 'Caja abierta' : 'Caja cerrada'}
                          tone={branch.cashOpen ? 'success' : 'neutral'}
                        />
                        <StatusChip
                          label={`${branch.activeOrders} en curso`}
                          tone={branch.activeOrders > 0 ? 'info' : 'neutral'}
                        />
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
                {branches.length > 1 && (
                  <TableRow sx={{ '& td': { borderBottom: 0, fontWeight: 800 } }}>
                    <TableCell>Total</TableCell>
                    {METRICS.map((metric) => (
                      <TableCell key={metric.key} align="right">
                        {metric.format(totals[metric.key])}
                      </TableCell>
                    ))}
                    <TableCell />
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <Typography variant="caption" color="text.secondary">
            En verde la mejor sede de cada indicador y en rojo la más baja. Las ventas son pedidos
            pagados del período; los gastos sin sede asignada no se reparten entre sedes.
          </Typography>

          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Ventas por día
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Cada sede en su color.
            </Typography>
            {chartData.length === 0 ? (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ py: 6, textAlign: 'center' }}
              >
                No hay ventas en este período.
              </Typography>
            ) : (
              <Box sx={{ height: 320, mt: 1.5 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke={chartGrid} />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: chartAxis, fontSize: 11 }}
                      axisLine={{ stroke: chartGrid }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: chartAxis, fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v: number) =>
                        v >= 1_000_000
                          ? `${(v / 1_000_000).toFixed(1)}M`
                          : `${Math.round(v / 1000)}k`
                      }
                      width={44}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1A1A1D',
                        border: '1px solid #2A2A2E',
                        borderRadius: 8,
                      }}
                      labelStyle={{ color: brand.bone }}
                      formatter={(value, name) => [
                        formatCOP(Number(value)),
                        branches.find((b) => b.branchId === name)?.name ?? String(name),
                      ]}
                    />
                    <Legend
                      formatter={(value) =>
                        branches.find((b) => b.branchId === value)?.name ?? value
                      }
                    />
                    {branches.map((branch) => (
                      <Bar
                        key={branch.branchId}
                        dataKey={branch.branchId}
                        fill={colorOf(branch.branchId)}
                        radius={[3, 3, 0, 0]}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            )}
          </Paper>
        </Stack>
      )}
    </>
  );
}
