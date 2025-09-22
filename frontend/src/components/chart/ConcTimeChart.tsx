import React from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Area, ResponsiveContainer } from 'recharts';

export interface ConcTimeChartProps {
  times: number[];
  conc: number[];
  lower?: number[];
  upper?: number[];
}

export default function ConcTimeChart({ times, conc, lower, upper }: ConcTimeChartProps) {
  const data = (times || []).map((t, i) => ({ t, y: conc?.[i] ?? null, lo: lower?.[i] ?? null, hi: upper?.[i] ?? null }));
  return (
    <ResponsiveContainer width="100%" height={360}>
      <LineChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 10 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis type="number" dataKey="t" domain={[0, 48]} tickCount={12} label={{ value: 'Hours', position: 'insideBottom', offset: -5 }} />
        <YAxis label={{ value: 'Concentration (mg/L)', angle: -90, position: 'insideLeft' }} />
        <Tooltip formatter={(v: any, name: string, props: any) => [typeof v === 'number' ? v.toFixed(2) : v, name]} labelFormatter={(l) => `t=${l.toFixed ? l.toFixed(1) : l} h`} />
        {lower && upper && (
          <Area type="monotone" dataKey="hi" stroke="none" fill="rgba(25, 118, 210, 0.10)" activeDot={false} dot={false} isAnimationActive={false} />
        )}
        <Line type="monotone" dataKey="y" stroke="#1976d2" dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
