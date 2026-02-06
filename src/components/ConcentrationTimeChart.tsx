import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ComposedChart, Line, Scatter, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export default function ConcentrationTimeChart({
  curve,
  levels,
  showBand,
}: {
  curve?: Array<{ t_hr: number; conc_mg_l: number }>;
  levels?: Array<{ time_hr: number; concentration_mg_l: number }>;
  showBand?: boolean;
}) {
  const base = curve || [];
  const bandUpper = showBand ? base.map((p) => ({ ...p, conc_mg_l: p.conc_mg_l * 1.2 })) : [];
  const bandLower = showBand ? base.map((p) => ({ ...p, conc_mg_l: p.conc_mg_l * 0.8 })) : [];

  const levelPoints = (levels || []).map((l) => ({ t_hr: l.time_hr, conc_mg_l: l.concentration_mg_l }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Concentration–Time (0–48h)</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={curve || []} margin={{ left: 10, right: 10, top: 10, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="t_hr" tickFormatter={(v) => `${v}h`} />
            <YAxis />
            <Tooltip formatter={(v: number) => Number(v).toFixed(2)} labelFormatter={(l) => `${l}h`} />

            {showBand && (
              <>
                <Line type="monotone" data={bandUpper} dataKey="conc_mg_l" stroke="#93c5fd" dot={false} />
                <Line type="monotone" data={bandLower} dataKey="conc_mg_l" stroke="#93c5fd" dot={false} />
              </>
            )}
            <Line type="monotone" dataKey="c" stroke="#2563eb" dot={false} />
            {levels && levels.length > 0 && (
              <Scatter data={levels.map(l => ({ t: l.timeHr, c: l.concentration }))} fill="#ef4444" />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
