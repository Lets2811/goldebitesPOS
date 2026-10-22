import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import ChartCard from './ChartCard';
import { brand, chartAxis, chartGrid } from '../../../theme/palette';

export default function TopProductsChart({ data }: { data: { name: string; cantidad: number }[] }) {
  return (
    <ChartCard title="Productos más vendidos" subtitle="Unidades vendidas hoy">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 0 }}>
          <CartesianGrid horizontal={false} stroke={chartGrid} />
          <XAxis
            type="number"
            tick={{ fill: chartAxis, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fill: chartAxis, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={130}
          />
          <Tooltip
            cursor={{ fill: 'rgba(212,175,55,0.08)' }}
            contentStyle={{
              backgroundColor: '#1A1A1D',
              border: '1px solid #2A2A2E',
              borderRadius: 8,
            }}
            labelStyle={{ color: brand.bone }}
            formatter={(value) => [`${value} uds`, 'Cantidad']}
          />
          <Bar dataKey="cantidad" fill={brand.gold} radius={[0, 4, 4, 0]} maxBarSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
