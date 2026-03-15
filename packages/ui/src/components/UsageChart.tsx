import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface Props {
  data: { date: string; cost: number; tokens: number }[];
  dataKey?: 'cost' | 'tokens';
}

export default function UsageChart({ data, dataKey = 'cost' }: Props) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data}>
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--cc-text-muted)' }} />
        <YAxis tick={{ fontSize: 11, fill: 'var(--cc-text-muted)' }} />
        <Tooltip
          contentStyle={{
            background: 'var(--cc-bg-surface)',
            border: '1px solid var(--cc-border)',
            borderRadius: 8,
          }}
          labelStyle={{ color: 'var(--cc-text-secondary)' }}
        />
        <Line
          type="monotone"
          dataKey={dataKey}
          stroke="var(--cc-accent)"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
