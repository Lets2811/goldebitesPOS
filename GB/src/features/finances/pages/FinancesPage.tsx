import { useMemo, useState } from 'react';
import Grid from '@mui/material/Grid';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import IconButton from '@mui/material/IconButton';
import type { ColumnDef } from '@tanstack/react-table';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { useSnackbar } from 'notistack';
import { DollarSign, TrendingDown, Percent, Landmark, Wallet, Trash2 } from 'lucide-react';
import PageHeader from '../../../components/common/PageHeader';
import StatCard from '../../../components/common/StatCard';
import DataTable from '../../../components/common/DataTable';
import DateDisplay from '../../../components/common/DateDisplay';
import ConfirmDialog from '../../../components/common/ConfirmDialog';
import { Can } from '../../../modules/auth/components/can';
import { usePermissions } from '../../../modules/auth/hooks/use-permissions';
import { formatCOP, formatPercent } from '../../../utils/format';
import { brand, chartAxis, chartCategorical, chartGrid } from '../../../theme/palette';
import { useAuthStore } from '../../../modules/auth/store/auth.store';
import { useSalesByDay } from '../../../modules/analytics/hooks/use-sales-by-day';
import { useExpenses } from '../../../modules/finances/hooks/use-expenses';
import { useExpenseSummary } from '../../../modules/finances/hooks/use-expense-summary';
import { useUpdateExpense } from '../../../modules/finances/hooks/use-update-expense';
import { useDeleteExpense } from '../../../modules/finances/hooks/use-delete-expense';
import { EXPENSE_CATEGORY_LABELS } from '../../../modules/finances/expense-category';
import {
  EXPENSE_PAYMENT_SOURCE_LABELS,
  expenseErrorMessage,
  toUpdateExpensePayload,
} from '../../../modules/finances/expense-payment-source';
import type { Expense } from '../../../modules/finances/types/expense.types';
import type { ExpenseFormValues } from '../schemas/expenseSchema';
import ExpenseFormDrawer from '../components/ExpenseFormDrawer';
import FundsTab from '../components/FundsTab';

interface MonthRange {
  key: string;
  label: string;
  year: number;
  month: number;
  dateFrom: string;
  dateTo: string;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function buildMonths(): MonthRange[] {
  const now = new Date();
  const months: MonthRange[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = d.getMonth();
    const dateFrom = `${year}-${pad(month + 1)}-01`;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const dateTo = `${year}-${pad(month + 1)}-${pad(lastDay)}`;
    const label = d.toLocaleDateString('es-CO', { month: 'short', year: 'numeric' });
    months.push({ key: `${year}-${month}`, label, year, month, dateFrom, dateTo });
  }
  return months;
}

export default function FinancesPage() {
  const { enqueueSnackbar } = useSnackbar();
  // Los fondos son un servicio adicional: la pestaña solo existe para quien lo tiene.
  const { hasFeature } = usePermissions();
  const hasFunds = hasFeature('finances.funds');
  const [tab, setTab] = useState<'resumen' | 'fondos'>('resumen');
  const showFunds = hasFunds && tab === 'fondos';
  const branchId = useAuthStore((s) => s.user?.branchId ?? undefined);

  const months = useMemo(() => buildMonths(), []);
  const [monthIndex, setMonthIndex] = useState(months.length - 1);
  const selected = months[monthIndex];

  const fullRange = { dateFrom: months[0].dateFrom, dateTo: months[months.length - 1].dateTo };

  const { data: dailySales } = useSalesByDay({ ...fullRange, branchId });
  const { data: allExpensesData } = useExpenses({
    dateFrom: fullRange.dateFrom,
    dateTo: fullRange.dateTo,
    limit: 100,
  });
  const { data: categorySummary } = useExpenseSummary(selected.dateFrom, selected.dateTo);

  const updateExpense = useUpdateExpense();
  const deleteExpense = useDeleteExpense();

  const [formOpen, setFormOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null);

  const allExpenses = useMemo(() => allExpensesData?.data ?? [], [allExpensesData]);
  const sales = useMemo(() => dailySales ?? [], [dailySales]);
  const summary = useMemo(() => categorySummary ?? [], [categorySummary]);

  const monthExpenses = useMemo(
    () =>
      allExpenses.filter(
        (e) =>
          e.expenseDate.slice(0, 10) >= selected.dateFrom &&
          e.expenseDate.slice(0, 10) <= selected.dateTo,
      ),
    [allExpenses, selected],
  );

  const revenue = useMemo(
    () =>
      sales
        .filter(
          (s) => s.date.slice(0, 10) >= selected.dateFrom && s.date.slice(0, 10) <= selected.dateTo,
        )
        .reduce((sum, s) => sum + s.totalAmount, 0),
    [sales, selected],
  );

  const totalExpenses = summary.reduce((sum, s) => sum + s.total, 0);
  const estimatedProfit = revenue - totalExpenses;
  const cogs = summary.find((s) => s.category === 'COGS')?.total ?? 0;
  const grossMargin = revenue - cogs;
  const operating = summary.find((s) => s.category === 'OPERATING')?.total ?? 0;
  const payroll = summary.find((s) => s.category === 'PAYROLL')?.total ?? 0;
  const marketing = summary.find((s) => s.category === 'MARKETING')?.total ?? 0;

  const chartData = useMemo(
    () =>
      months.map((m) => ({
        month: m.label,
        ingresos: sales
          .filter((s) => s.date.slice(0, 10) >= m.dateFrom && s.date.slice(0, 10) <= m.dateTo)
          .reduce((sum, s) => sum + s.totalAmount, 0),
        gastos: allExpenses
          .filter(
            (e) =>
              e.expenseDate.slice(0, 10) >= m.dateFrom && e.expenseDate.slice(0, 10) <= m.dateTo,
          )
          .reduce((sum, e) => sum + e.amount, 0),
      })),
    [months, sales, allExpenses],
  );

  const onError = (error: unknown) =>
    enqueueSnackbar(expenseErrorMessage(error), { variant: 'error' });

  // Los gastos se registran en "Compras y gastos"; aquí solo se corrigen los ya registrados.
  const handleSubmit = (values: ExpenseFormValues) => {
    if (!editingExpense) return;
    updateExpense.mutate(
      { id: editingExpense.id, payload: toUpdateExpensePayload(values, editingExpense) },
      {
        onSuccess: () => {
          enqueueSnackbar('Gasto actualizado correctamente', { variant: 'success' });
          setFormOpen(false);
        },
        onError,
      },
    );
  };

  const columns: ColumnDef<Expense, unknown>[] = [
    {
      id: 'date',
      header: 'Fecha',
      cell: ({ row }) => <DateDisplay value={row.original.expenseDate} variant="body2" />,
    },
    { id: 'name', header: 'Nombre', cell: ({ row }) => row.original.name ?? '—' },
    {
      id: 'category',
      header: 'Categoría',
      cell: ({ row }) => EXPENSE_CATEGORY_LABELS[row.original.category],
    },
    {
      id: 'paymentSource',
      header: 'Pagado con',
      cell: ({ row }) => EXPENSE_PAYMENT_SOURCE_LABELS[row.original.paymentSource],
    },
    { accessorKey: 'description', header: 'Motivo' },
    {
      id: 'responsible',
      header: 'Responsable',
      cell: ({ row }) => row.original.responsible ?? '—',
    },
    { id: 'amount', header: 'Cantidad', cell: ({ row }) => formatCOP(row.original.amount) },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <Can permission="finances.manage">
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              setDeletingExpense(row.original);
            }}
          >
            <Trash2 size={14} />
          </IconButton>
        </Can>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Finanzas"
        subtitle="Ventas, gastos y utilidad estimada del negocio."
        breadcrumbs={[{ label: 'Finanzas' }]}
        actions={
          showFunds ? undefined : (
            <TextField
              select
              size="small"
              label="Periodo"
              value={monthIndex}
              onChange={(e) => setMonthIndex(Number(e.target.value))}
              sx={{ minWidth: 160 }}
            >
              {months.map((m, idx) => (
                <MenuItem key={m.key} value={idx}>
                  {m.label}
                </MenuItem>
              ))}
            </TextField>
          )
        }
      />

      {hasFunds && (
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
          <Tab label="Resumen" value="resumen" />
          <Tab label="Fondos" value="fondos" />
        </Tabs>
      )}

      {showFunds ? (
        <FundsTab />
      ) : (
        <>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <StatCard label="Ventas" value={formatCOP(revenue)} icon={DollarSign} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <StatCard label="Costo de ventas" value={formatCOP(cogs)} icon={TrendingDown} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <StatCard
                label="Margen bruto"
                value={formatCOP(grossMargin)}
                icon={Percent}
                helperText={revenue > 0 ? formatPercent(grossMargin / revenue) : undefined}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <StatCard
                label="Utilidad estimada"
                value={formatCOP(estimatedProfit)}
                icon={Landmark}
                accent={estimatedProfit >= 0 ? undefined : '#D9534F'}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <StatCard label="Gastos operativos" value={formatCOP(operating)} icon={Wallet} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <StatCard label="Gastos de nómina" value={formatCOP(payroll)} icon={Wallet} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <StatCard label="Gastos de marketing" value={formatCOP(marketing)} icon={Wallet} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <StatCard label="Gastos totales" value={formatCOP(totalExpenses)} icon={Landmark} />
            </Grid>
          </Grid>

          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                Ingresos vs. gastos (últimos 6 meses)
              </Typography>
              <Box sx={{ mt: 1.5 }}>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData} margin={{ left: 0, right: 8, top: 16, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke={chartGrid} />
                    <XAxis
                      dataKey="month"
                      tick={{ fill: chartAxis, fontSize: 11 }}
                      axisLine={{ stroke: chartGrid }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: chartAxis, fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `${Math.round(v / 1_000_000)}M`}
                      width={40}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1A1A1D',
                        border: '1px solid #2A2A2E',
                        borderRadius: 8,
                      }}
                      formatter={(value) => formatCOP(Number(value))}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar
                      dataKey="ingresos"
                      name="Ingresos"
                      fill={brand.gold}
                      radius={[4, 4, 0, 0]}
                      maxBarSize={28}
                    />
                    <Bar
                      dataKey="gastos"
                      name="Gastos"
                      fill={chartCategorical[1]}
                      radius={[4, 4, 0, 0]}
                      maxBarSize={28}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>

          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
            Gastos registrados — {selected.label}
          </Typography>
          <DataTable
            columns={columns}
            data={monthExpenses}
            onRowClick={(row) => {
              setEditingExpense(row);
              setFormOpen(true);
            }}
            emptyTitle="Sin gastos registrados en este periodo"
            pageSize={10}
          />
        </>
      )}

      <ExpenseFormDrawer
        open={formOpen}
        loading={updateExpense.isPending}
        initialExpense={editingExpense}
        onClose={() => setFormOpen(false)}
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        open={Boolean(deletingExpense)}
        title="Eliminar gasto"
        description={`¿Seguro que deseas eliminar "${deletingExpense?.name ?? deletingExpense?.description}"? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        destructive
        onClose={() => setDeletingExpense(null)}
        onConfirm={() => {
          if (!deletingExpense) return;
          deleteExpense.mutate(deletingExpense.id, {
            onSuccess: () => enqueueSnackbar('Gasto eliminado', { variant: 'success' }),
            onError,
            onSettled: () => setDeletingExpense(null),
          });
        }}
      />
    </>
  );
}
