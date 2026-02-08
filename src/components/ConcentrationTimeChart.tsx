import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Scatter } from "recharts";

export default function ConcentrationTimeChart({
  curve,
  levels,
  band,
}: {
  curve?: Array<{ t_hr: number; conc_mg_l: number }>;
  levels?: Array<{ time_hr: number; concentration_mg_l: number }>;
  band?: { lower: Array<{ t_hr: number; conc_mg_l: number }>; upper: Array<{ t_hr: number; conc_mg_l: number }> } | null;
}) {
  const base = curve || [];
  const bandUpper = band?.upper ?? [];
  const bandLower = band?.lower ?? [];

  const levelPoints = (levels || []).map((l) => ({ t_hr: l.time_hr, conc_mg_l: l.concentration_mg_l }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Concentration–Time (0–48h)</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={base} margin={{ left: 10, right: 10, top: 10, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="t_hr" tickFormatter={(v) => `${v}h`} />
            <YAxis />
            <Tooltip formatter={(v: number) => Number(v).toFixed(2)} labelFormatter={(l) => `${l}h`} />

            {bandUpper.length > 0 && bandLower.length > 0 && (
              <>
                <Line type="monotone" data={bandUpper} dataKey="conc_mg_l" stroke="#93c5fd" dot={false} />
                <Line type="monotone" data={bandLower} dataKey="conc_mg_l" stroke="#93c5fd" dot={false} />
              </>
            )}

            <Line type="monotone" dataKey="conc_mg_l" stroke="#2563eb" dot={false} />

            {levelPoints.length > 0 && (
              <Scatter data={levelPoints} fill="#ef4444" />
            )}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
