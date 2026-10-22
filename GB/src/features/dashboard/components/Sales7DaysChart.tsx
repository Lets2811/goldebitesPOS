import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import ChartCard from './ChartCard';
import { brand, chartAxis, chartGrid } from '../../../theme/palette';
import { formatCOP } from '../../../utils/format';

interface DailySalesPoint {
  date: string;
  label: string;
  sales: number;
  orders: number;
}

export default function Sales7DaysChart({ data }: { data: DailySalesPoint[] }) {
  return (
    <ChartCard title="Ventas últimos 7 días" subtitle="Comparativo diario de ingresos">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
          <defs>
            <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={brand.gold} stopOpacity={0.35} />
              <stop offset="100%" stopColor={brand.gold} stopOpacity={0} />
            </linearGradient>
          </defs>
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
            tickFormatter={(v) => `${Math.round(v / 1_000_000)}M`}
            width={40}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1A1A1D',
              border: '1px solid #2A2A2E',
              borderRadius: 8,
            }}
            labelStyle={{ color: brand.bone }}
            formatter={(value) => [formatCOP(Number(value)), 'Ventas']}
          />
          <Area
            type="monotone"
            dataKey="sales"
            stroke={brand.gold}
            strokeWidth={2}
            fill="url(#salesGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
