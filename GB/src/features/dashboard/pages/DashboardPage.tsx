import { useMemo } from 'react';
import Grid from '@mui/material/Grid';
import { DollarSign, ClipboardList, Activity, Receipt, Wallet, Boxes } from 'lucide-react';
import PageHeader from '../../../components/common/PageHeader';
import MetricCard from '../../../components/common/MetricCard';
import StatCard from '../../../components/common/StatCard';
import AlertPanel, { type AlertItem } from '../../../components/common/AlertPanel';
import LoadingSkeleton from '../../../components/common/LoadingSkeleton';
import ErrorState from '../../../components/common/ErrorState';
import { formatCOP } from '../../../utils/format';
import { useAuthStore } from '../../../modules/auth/store/auth.store';
import { useCurrentBusiness } from '../../../modules/businesses/hooks/use-current-business';
import { useDashboardSummary } from '../../../modules/dashboard/hooks/use-dashboard-summary';
import { useSalesByDay } from '../../../modules/analytics/hooks/use-sales-by-day';
import { useTopProducts } from '../../../modules/analytics/hooks/use-top-products';
import { useKitchenQueue } from '../../../modules/kitchen/hooks/use-kitchen-queue';
import { useLowStock } from '../../../modules/inventory/hooks/use-low-stock';
import { useNavigate } from 'react-router-dom';
import Sales7DaysChart from '../components/Sales7DaysChart';
import TopProductsChart from '../components/TopProductsChart';
import KitchenSnapshot from '../components/KitchenSnapshot';
import BranchTodayStrip from '../components/BranchTodayStrip';
import { usePermissions } from '../../../modules/auth/hooks/use-permissions';

function last7DaysRange(): { dateFrom: string; dateTo: string } {
  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - 6);
  from.setHours(0, 0, 0, 0);
  return { dateFrom: from.toISOString(), dateTo: now.toISOString() };
}

const WEEKDAY_FORMATTER = new Intl.DateTimeFormat('es-CO', {
  weekday: 'short',
  timeZone: 'America/Bogota',
});

export default function DashboardPage() {
  const { data: business } = useCurrentBusiness();
  const navigate = useNavigate();
  const branchId = useAuthStore((s) => s.user?.branchId ?? undefined);
  const { hasPermission } = usePermissions();
  // Working across all branches: each one's day, side by side.
  const showBranchStrip = !branchId && hasPermission('branches.switch');
  const { dateFrom, dateTo } = useMemo(() => last7DaysRange(), []);

  const { data: summary, isLoading, isError, refetch } = useDashboardSummary(branchId);
  const { data: dailySales } = useSalesByDay({ dateFrom, dateTo, branchId });
  const { data: topProducts } = useTopProducts({ dateFrom, dateTo, branchId, limit: 6 });
  const { data: kitchenQueue } = useKitchenQueue(branchId);
  const { data: lowStock } = useLowStock(branchId);

  const salesChartData = useMemo(
    () =>
      (dailySales ?? []).map((day) => ({
        date: day.date,
        label: WEEKDAY_FORMATTER.format(new Date(day.date)),
        sales: day.totalAmount,
        orders: day.orderCount,
      })),
    [dailySales],
  );

  const topProductsChartData = useMemo(
    () => (topProducts ?? []).map((p) => ({ name: p.productName, cantidad: p.quantitySold })),
    [topProducts],
  );

  const alerts: AlertItem[] = useMemo(() => {
    const list: AlertItem[] = [];
    for (const item of (lowStock ?? []).slice(0, 3)) {
      list.push({
        id: `inv-${item.inventoryItemId}`,
        title: `Inventario: ${item.name}`,
        message: `${item.currentStock} ${item.unit} disponibles (mínimo ${item.minimumStock} ${item.unit})`,
        level: 'warning',
      });
    }
    if (summary?.cashSessionOpen === false) {
      list.push({
        id: 'cash-closed',
        title: 'Caja cerrada',
        message: 'No hay una sesión de caja abierta en este momento.',
        level: 'info',
      });
    }
    return list;
  }, [lowStock, summary]);

  if (isLoading) {
    return (
      <>
        <PageHeader
          title="Centro de operaciones"
          breadcrumbs={[{ label: 'Centro de operaciones' }]}
        />
        <LoadingSkeleton variant="page" />
      </>
    );
  }

  if (isError || !summary) {
    return (
      <>
        <PageHeader
          title="Centro de operaciones"
          breadcrumbs={[{ label: 'Centro de operaciones' }]}
        />
        <ErrorState onRetry={() => refetch()} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Centro de operaciones"
        subtitle={
          business?.name
            ? `Resumen en vivo de la operación de ${business.name}.`
            : 'Resumen en vivo de la operación.'
        }
        breadcrumbs={[{ label: 'Centro de operaciones' }]}
      />

      {showBranchStrip && <BranchTodayStrip />}

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
          <MetricCard
            label="Ventas del día"
            value={formatCOP(summary.todaySales.totalAmount)}
            icon={DollarSign}
            to="/pedidos"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
          <MetricCard
            label="Pedidos realizados hoy"
            value={String(summary.todaySales.orderCount)}
            icon={ClipboardList}
            to="/pedidos"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
          <MetricCard
            label="Pedidos activos"
            value={String(summary.activeOrders)}
            icon={Activity}
            to="/pedidos"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
          <StatCard
            label="Ticket promedio"
            value={formatCOP(summary.todaySales.averageTicket)}
            icon={Receipt}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
          <MetricCard
            label="Caja"
            value={
              summary.cashSessionOpen === null
                ? 'Sin sucursal'
                : summary.cashSessionOpen
                  ? 'Abierta'
                  : 'Cerrada'
            }
            icon={Wallet}
            to="/caja"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
          <MetricCard
            label="Insumos con stock bajo"
            value={String(summary.lowStockCount)}
            icon={Boxes}
            to="/inventario"
            tone={summary.lowStockCount > 0 ? 'warning' : 'default'}
          />
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Sales7DaysChart data={salesChartData} />
        </Grid>
        <Grid size={{ xs: 12, lg: 4 }}>
          <TopProductsChart data={topProductsChartData} />
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 6 }}>
          <AlertPanel
            alerts={alerts}
            onAlertClick={(alert) => {
              if (alert.id.startsWith('inv-')) navigate('/inventario');
              else if (alert.id === 'cash-closed') navigate('/caja');
            }}
          />
        </Grid>
        <Grid size={{ xs: 12, lg: 6 }}>
          <KitchenSnapshot orders={kitchenQueue ?? []} />
        </Grid>
      </Grid>
    </>
  );
}
