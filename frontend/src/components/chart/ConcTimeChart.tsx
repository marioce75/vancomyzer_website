import React from 'react';
import { ResponsiveContainer, ComposedChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceArea, Scatter, Legend } from 'recharts';

export interface LevelPoint { x: number; y: number; tag?: string }
export interface ConcTimeChartProps {
  times: number[];
  conc: number[];
  lower?: number[];
  upper?: number[];
  levels?: LevelPoint[];
  shadeAuc?: boolean;
}

export default function ConcTimeChart({ times, conc, lower, upper, levels, shadeAuc = true }: ConcTimeChartProps) {
  const data = (times || []).map((t, i) => ({
    t,
    y: conc?.[i] ?? null,
    lo: lower?.[i] ?? null,
    hi: upper?.[i] ?? null,
  }));

  const levelData = (levels || []).map((d) => ({ t: d.x, y: d.y, tag: d.tag }));

  return (
    <ResponsiveContainer width="100%" height={360}>
      <ComposedChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 10 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis type="number" dataKey="t" domain={[0, 48]} tickCount={12} label={{ value: 'Hours', position: 'insideBottom', offset: -5 }} />
        <YAxis label={{ value: 'Concentration (mg/L)', angle: -90, position: 'insideLeft' }} allowDecimals domain={[0, 'auto']} />
        {shadeAuc && (
          <ReferenceArea x1={0} x2={24} y1={0} y2={'auto'} fill="rgba(25,118,210,0.08)" strokeOpacity={0} />
        )}
        <Tooltip
          formatter={(v: any, name: string) => {
            const label = name === 'y' ? 'Conc' : name === 'lo' ? 'Lower' : name === 'hi' ? 'Upper' : name;
            return [typeof v === 'number' ? v.toFixed(2) : v, label];
          }}
          labelFormatter={(l: any) => (typeof l === 'number' ? `t=${l.toFixed(1)} h` : String(l))}
        />
        <Legend />
        {lower && upper && (
          <>
            <Line type="monotone" dataKey="lo" name="Lower" stroke="rgba(25,118,210,0.35)" dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="hi" name="Upper" stroke="rgba(25,118,210,0.35)" dot={false} isAnimationActive={false} />
          </>
        )}
        <Line type="monotone" dataKey="y" name="Concentration" stroke="#1976d2" dot={false} isAnimationActive={false} />
        {levelData.length > 0 && (
          <Scatter data={levelData} name="Measured" fill="rgba(220,0,78,0.9)" />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
