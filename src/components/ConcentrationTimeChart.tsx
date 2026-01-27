import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Line, LineChart, Scatter, ScatterChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export default function ConcentrationTimeChart({ curve, levels, showBand }: {
  curve?: Array<{ t: number; c: number }>;
  levels?: Array<{ timeHr: number; concentration: number }>;
  showBand?: boolean;
}) {
  const bandUpper = curve?.map(p => ({ ...p, c: p.c * 1.2 })) ?? [];
  const bandLower = curve?.map(p => ({ ...p, c: p.c * 0.8 })) ?? [];

  return (
    <Card>
      <CardHeader><CardTitle>Concentration–Time (24h)</CardTitle></CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={curve || []} margin={{ left: 10, right: 10, top: 10, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="t" domain={[0, 24]} tickFormatter={(v) => `${v}h`} />
            <YAxis />
            <Tooltip formatter={(v: number) => Math.round(v)} labelFormatter={(l) => `${l}h`} />
            {showBand && (
              <>
                <Line type="monotone" data={bandUpper} dataKey="c" stroke="#93c5fd" dot={false} />
                <Line type="monotone" data={bandLower} dataKey="c" stroke="#93c5fd" dot={false} />
              </>
            )}
            <Line type="monotone" dataKey="c" stroke="#2563eb" dot={false} />
            {levels && levels.length > 0 && (
              <ScatterChart>
                <Scatter data={levels.map(l => ({ t: l.timeHr, c: l.concentration }))} fill="#ef4444" />
              </ScatterChart>
            )}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
