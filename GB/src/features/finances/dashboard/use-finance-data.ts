import { useMemo } from 'react';
import dayjs from 'dayjs';
import { useSalesByDay } from '../../../modules/analytics/hooks/use-sales-by-day';
import { useTopProducts } from '../../../modules/analytics/hooks/use-top-products';
import { useAuthStore } from '../../../modules/auth/store/auth.store';
import { useExpenseCategories } from '../../../modules/finances/hooks/use-expense-categories';
import { useExpenseDailyTotals } from '../../../modules/finances/hooks/use-expense-daily-totals';
import { useExpenseSummary } from '../../../modules/finances/hooks/use-expense-summary';
import { useExpenses } from '../../../modules/finances/hooks/use-expenses';
import type { Expense } from '../../../modules/finances/types/expense.types';
import type { TopProduct } from '../../../modules/analytics/types/analytics.types';
import { daysInPeriod, periodInstants, type Period } from '../period';

/** Hasta cuántos días se grafican uno por uno; un período más largo se agrupa por mes. */
const MAX_DAILY_POINTS = 62;

export interface CategoryTotal {
  code: string;
  name: string;
  total: number;
  isCostOfSales: boolean;
}

export interface TimelinePoint {
  label: string;
  ventas: number;
  gastos: number;
}

/** Todo lo que los widgets de Finanzas pueden mostrar de un período, ya calculado. */
export interface FinanceData {
  period: Period;
  loading: boolean;
  /** Ventas: pedidos pagados por completo. */
  sales: number;
  salesCount: number;
  averageTicket: number;
  expenses: number;
  /** Gastos de los tipos marcados como costo de ventas. */
  costOfSales: number;
  grossMargin: number;
  /** Ventas menos todos los gastos. */
  profit: number;
  byCategory: CategoryTotal[];
  timeline: TimelinePoint[];
  expenseList: Expense[];
  /** Gastos del período en total; la lista trae como máximo los 100 más recientes. */
  expenseCount: number;
  topProducts: TopProduct[];
}

export function useFinanceData(period: Period): FinanceData {
  const branchId = useAuthStore((s) => s.user?.branchId ?? undefined);
  const instants = useMemo(() => periodInstants(period), [period]);

  const salesByDay = useSalesByDay({ ...instants, branchId });
  const topProducts = useTopProducts({ ...instants, branchId, limit: 8 });
  const expenseDays = useExpenseDailyTotals(period.from, period.to);
  const expenseSummary = useExpenseSummary(period.from, period.to);
  const expenseList = useExpenses({ dateFrom: period.from, dateTo: period.to, limit: 100 });
  const { categories } = useExpenseCategories();

  return useMemo(() => {
    const salesDays = salesByDay.data ?? [];
    const spendDays = expenseDays.data ?? [];

    const sales = salesDays.reduce((sum, day) => sum + day.totalAmount, 0);
    const salesCount = salesDays.reduce((sum, day) => sum + day.orderCount, 0);

    // Los tipos sin gastos en el período no aparecen; uno cuyo tipo ya no existe conserva su código como nombre.
    const byCategory: CategoryTotal[] = (expenseSummary.data ?? [])
      .map((row) => {
        const category = categories.find((candidate) => candidate.code === row.category);
        return {
          code: row.category,
          name: category?.name ?? row.category,
          total: row.total,
          isCostOfSales: category?.isCostOfSales ?? false,
        };
      })
      .filter((row) => row.total > 0)
      .sort((a, b) => b.total - a.total);

    const expenses = byCategory.reduce((sum, row) => sum + row.total, 0);
    const costOfSales = byCategory.filter((row) => row.isCostOfSales).reduce((sum, row) => sum + row.total, 0);

    // Cada punto es un día; un período largo se resume por mes para que la gráfica se pueda leer.
    const byMonth = daysInPeriod(period) > MAX_DAILY_POINTS;
    const bucket = (date: string) => (byMonth ? date.slice(0, 7) : date.slice(0, 10));
    const points = new Map<string, TimelinePoint>();
    const start = dayjs(period.from);
    const steps = byMonth ? dayjs(period.to).diff(start.startOf('month'), 'month') + 1 : daysInPeriod(period);
    for (let step = 0; step < steps; step++) {
      const date = byMonth ? start.startOf('month').add(step, 'month') : start.add(step, 'day');
      const key = date.format(byMonth ? 'YYYY-MM' : 'YYYY-MM-DD');
      const label = byMonth
        ? date.toDate().toLocaleDateString('es-CO', { month: 'short', year: '2-digit' })
        : date.toDate().toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
      points.set(key, { label, ventas: 0, gastos: 0 });
    }
    for (const day of salesDays) {
      const point = points.get(bucket(day.date));
      if (point) point.ventas += day.totalAmount;
    }
    for (const day of spendDays) {
      const point = points.get(bucket(day.date));
      if (point) point.gastos += day.total;
    }

    return {
      period,
      loading: salesByDay.isLoading || expenseSummary.isLoading || expenseDays.isLoading,
      sales,
      salesCount,
      averageTicket: salesCount > 0 ? sales / salesCount : 0,
      expenses,
      costOfSales,
      grossMargin: sales - costOfSales,
      profit: sales - expenses,
      byCategory,
      timeline: [...points.values()],
      expenseList: expenseList.data?.data ?? [],
      expenseCount: expenseList.data?.meta?.total ?? expenseList.data?.data.length ?? 0,
      topProducts: topProducts.data ?? [],
    };
  }, [period, salesByDay, expenseDays, expenseSummary, expenseList, topProducts, categories]);
}
