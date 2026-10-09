import { useMemo } from 'react';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Ban, Percent, Users } from 'lucide-react';
import { useQueries } from '@tanstack/react-query';
import PageHeader from '../../../components/common/PageHeader';
import StatCard from '../../../components/common/StatCard';
import DataTable from '../../../components/common/DataTable';
import CurrencyDisplay from '../../../components/common/CurrencyDisplay';
import { formatCOP } from '../../../utils/format';
import { brand, chartAxis, chartCategorical, chartGrid } from '../../../theme/palette';
import type { ColumnDef } from '@tanstack/react-table';
import { salesByCategory, marginByProduct, inventoryRotation, wasteByReason } from '../utils';
import { useAuthStore } from '../../../modules/auth/store/auth.store';
import { useSalesByDay } from '../../../modules/analytics/hooks/use-sales-by-day';
import { useTopProducts } from '../../../modules/analytics/hooks/use-top-products';
import { useOrders } from '../../../modules/orders/hooks/use-orders';
import { ordersApi } from '../../../modules/orders/api/orders.api';
import { orderKeys } from '../../../modules/orders/api/orders.keys';
import { useProducts } from '../../../modules/products/hooks/use-products';
import { useProductCategories } from '../../../modules/product-categories/hooks/use-product-categories';
import { useInventoryItems } from '../../../modules/inventory/hooks/use-inventory-items';
import { useMovements } from '../../../modules/inventory/hooks/use-movements';
import { useWasteRecords } from '../../../modules/waste/hooks/use-waste-records';
import { useCustomers } from '../../../modules/customers/hooks/use-customers';
import type { Customer } from '../../../modules/customers/types/customer.types';

const TOOLTIP_STYLE = { backgroundColor: '#1A1A1D', border: '1px solid #2A2A2E', borderRadius: 8 };

const WEEKDAY_LABELS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

const FREQUENT_CUSTOMER_MIN_ORDERS = 3;

function last7DaysRange(): { dateFrom: string; dateTo: string } {
  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - 6);
  from.setHours(0, 0, 0, 0);
  return { dateFrom: from.toISOString(), dateTo: now.toISOString() };
}

function todayRange(): { dateFrom: string; dateTo: string } {
  const now = new Date();
  const from = new Date(now);
  from.setHours(0, 0, 0, 0);
  return { dateFrom: from.toISOString(), dateTo: now.toISOString() };
}

export default function AnalyticsPage() {
  const branchId = useAuthStore((s) => s.user?.branchId ?? undefined);

  const { dateFrom, dateTo } = useMemo(() => last7DaysRange(), []);
  const today = useMemo(() => todayRange(), []);

  const { data: dailySales } = useSalesByDay({ dateFrom, dateTo, branchId });
  const { data: realTopProducts } = useTopProducts({ dateFrom, dateTo, branchId, limit: 5 });

  const { data: todaysOrdersData } = useOrders({ ...today, branchId, limit: 100 });
  const { data: cancelledOrdersData } = useOrders({ status: 'CANCELLED', branchId, limit: 1 });
  const { data: productsData } = useProducts({ limit: 100 });
  const { data: categoriesData } = useProductCategories({ limit: 100 });
  const { data: inventoryItemsData } = useInventoryItems({ limit: 100 });
  const { data: movementsData } = useMovements({ branchId, limit: 100 });
  const { data: wasteData } = useWasteRecords({ branchId, limit: 100 });
  const { data: customersData } = useCustomers({ limit: 100 });

  const todaysOrders = useMemo(() => todaysOrdersData?.data ?? [], [todaysOrdersData]);
  const products = useMemo(() => productsData?.data ?? [], [productsData]);
  const categories = useMemo(() => categoriesData?.data ?? [], [categoriesData]);
  const inventoryItems = useMemo(() => inventoryItemsData?.data ?? [], [inventoryItemsData]);
  const movements = useMemo(() => movementsData?.data ?? [], [movementsData]);
  const wasteRecords = useMemo(() => wasteData?.data ?? [], [wasteData]);
  const customers = useMemo(() => customersData?.data ?? [], [customersData]);

  const todaysOrderDetails = useQueries({
    queries: todaysOrders.map((order) => ({
      queryKey: orderKeys.detail(order.id),
      queryFn: () => ordersApi.getOrder(order.id),
      staleTime: 30_000,
    })),
  });

  const salesLast7Days = useMemo(
    () =>
      (dailySales ?? []).map((day) => ({
        date: day.date,
        label: WEEKDAY_LABELS[new Date(day.date).getDay()],
        sales: day.totalAmount,
        orders: day.orderCount,
      })),
    [dailySales],
  );

  const todaysItemsByOrder = useMemo(
    () => todaysOrderDetails.map((result) => result.data?.items ?? []),
    [todaysOrderDetails],
  );

  const categoryData = useMemo(
    () => salesByCategory(todaysItemsByOrder, products, categories),
    [todaysItemsByOrder, products, categories],
  );
  const marginData = useMemo(() => marginByProduct(products), [products]);
  const rotationData = useMemo(() => inventoryRotation(movements, inventoryItems), [movements, inventoryItems]);
  const wasteByReasonData = useMemo(() => wasteByReason(wasteRecords), [wasteRecords]);
  const topSellers = realTopProducts ?? [];

  const cancelledCount = cancelledOrdersData?.meta.total ?? 0;
  const totalDiscounts = todaysOrders.reduce((sum, o) => sum + o.discountAmount, 0);
  const frequentCustomers = useMemo(
    () => [...customers].sort((a, b) => b.totalOrders - a.totalOrders).slice(0, 6),
    [customers],
  );
  const frequentCustomersCount = customers.filter((c) => c.totalOrders >= FREQUENT_CUSTOMER_MIN_ORDERS).length;

  const frequentCustomerColumns: ColumnDef<Customer, unknown>[] = [
    {
      id: 'name',
      header: 'Cliente',
      cell: ({ row }) => `${row.original.firstName} ${row.original.lastName ?? ''}`.trim(),
    },
    { accessorKey: 'totalOrders', header: 'Pedidos' },
    {
      id: 'totalSpent',
      header: 'Total gastado',
      cell: ({ row }) => <CurrencyDisplay value={row.original.totalSpent} variant="body2" sx={{ fontWeight: 700 }} />,
    },
  ];

  return (
    <>
      <PageHeader title="Analítica" subtitle="Reportes operativos y comerciales del negocio." breadcrumbs={[{ label: 'Analítica' }]} />

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <StatCard label="Pedidos cancelados (histórico)" value={String(cancelledCount)} icon={Ban} accent="#D9534F" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <StatCard label="Descuentos aplicados hoy" value={formatCOP(totalDiscounts)} icon={Percent} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <StatCard
            label={`Clientes frecuentes (${FREQUENT_CUSTOMER_MIN_ORDERS}+ pedidos)`}
            value={String(frequentCustomersCount)}
            icon={Users}
          />
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                Ventas por categoría (hoy)
              </Typography>
              <Box sx={{ height: 260, mt: 1.5 }}>
                {categoryData.length === 0 ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                    <Typography variant="body2" color="text.secondary">
                      Sin ventas registradas hoy
                    </Typography>
                  </Box>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={categoryData} dataKey="value" nameKey="category" innerRadius="55%" outerRadius="85%" paddingAngle={2}>
                        {categoryData.map((entry, idx) => (
                          <Cell key={entry.category} fill={chartCategorical[idx % chartCategorical.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => formatCOP(Number(v))} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                Ventas últimos 7 días
              </Typography>
              <Box sx={{ height: 260, mt: 1.5 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={salesLast7Days} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke={chartGrid} />
                    <XAxis dataKey="label" tick={{ fill: chartAxis, fontSize: 11 }} axisLine={{ stroke: chartGrid }} tickLine={false} />
                    <YAxis tick={{ fill: chartAxis, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${Math.round(v / 1_000_000)}M`} width={40} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => formatCOP(Number(v))} />
                    <Bar dataKey="sales" fill={brand.gold} radius={[4, 4, 0, 0]} maxBarSize={26} />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                Margen por producto
              </Typography>
              <Box sx={{ height: 280, mt: 1.5 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={marginData} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 0 }}>
                    <CartesianGrid horizontal={false} stroke={chartGrid} />
                    <XAxis type="number" tick={{ fill: chartAxis, fontSize: 11 }} axisLine={false} tickLine={false} unit="%" />
                    <YAxis type="category" dataKey="name" tick={{ fill: chartAxis, fontSize: 11 }} axisLine={false} tickLine={false} width={140} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => `${Number(v).toFixed(0)}%`} />
                    <Bar dataKey="margin" fill={chartCategorical[2]} radius={[0, 4, 4, 0]} maxBarSize={16} />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                Rotación de inventario (movimientos)
              </Typography>
              <Box sx={{ height: 280, mt: 1.5 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={rotationData} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 0 }}>
                    <CartesianGrid horizontal={false} stroke={chartGrid} />
                    <XAxis type="number" tick={{ fill: chartAxis, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" tick={{ fill: chartAxis, fontSize: 11 }} axisLine={false} tickLine={false} width={140} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Bar dataKey="movimientos" fill={chartCategorical[4]} radius={[0, 4, 4, 0]} maxBarSize={16} />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={12}>
          <Card>
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                Mermas por motivo (valor acumulado)
              </Typography>
              <Box sx={{ height: 260, mt: 1.5 }}>
                {wasteByReasonData.length === 0 ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                    <Typography variant="body2" color="text.secondary">
                      Sin mermas registradas
                    </Typography>
                  </Box>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={wasteByReasonData} dataKey="value" nameKey="reason" innerRadius="55%" outerRadius="85%" paddingAngle={2}>
                        {wasteByReasonData.map((entry, idx) => (
                          <Cell key={entry.reason} fill={chartCategorical[idx % chartCategorical.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => formatCOP(Number(v))} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
            Productos más vendidos (últimos 7 días)
          </Typography>
          <DataTable
            columns={[
              { accessorKey: 'productName', header: 'Producto' },
              { accessorKey: 'quantitySold', header: 'Unidades vendidas' },
              {
                id: 'revenue',
                header: 'Ingresos',
                cell: ({ row }) => (
                  <CurrencyDisplay value={row.original.revenue} variant="body2" sx={{ fontWeight: 700 }} />
                ),
              },
            ]}
            data={topSellers}
            hidePagination
            emptyTitle="Sin ventas registradas en los últimos 7 días"
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
            Clientes más frecuentes
          </Typography>
          <DataTable
            columns={frequentCustomerColumns}
            data={frequentCustomers}
            hidePagination
            emptyTitle="Sin clientes registrados"
          />
        </Grid>
      </Grid>
    </>
  );
}
