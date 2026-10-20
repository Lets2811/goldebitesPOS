import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import ChartCard from './ChartCard';
import { brand, chartAxis, chartGrid } from '../../../theme/palette';
import { formatCOP } from '../../../utils/format';

export default function SalesByHourChart({ data }: { data: { hour: string; ventas: number }[] }) {
  return (
    <ChartCard title="Ventas por hora" subtitle="Hoy · 8:00 a. m. – 9:00 p. m.">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={chartGrid} />
          <XAxis
            dataKey="hour"
            tick={{ fill: chartAxis, fontSize: 11 }}
            axisLine={{ stroke: chartGrid }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: chartAxis, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${Math.round(v / 1000)}k`}
            width={40}
          />
          <Tooltip
            cursor={{ fill: 'rgba(212,175,55,0.08)' }}
            contentStyle={{
              backgroundColor: '#1A1A1D',
              border: '1px solid #2A2A2E',
              borderRadius: 8,
            }}
            labelStyle={{ color: brand.bone }}
            formatter={(value) => [formatCOP(Number(value)), 'Ventas']}
          />
          <Bar dataKey="ventas" fill={brand.gold} radius={[4, 4, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
