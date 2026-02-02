import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Area, AreaChart, CartesianGrid, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export default function AucDoseSliderChart({
  doseMg,
  intervalHr,
  auc24,
  targetLow = 400,
  targetHigh = 600,
  onChange,
}: {
  doseMg: number;
  intervalHr: number;
  auc24: number;
  targetLow?: number;
  targetHigh?: number;
  onChange: (update: { doseMg?: number; intervalHr?: number }) => void;
}) {
  const data = useMemo(() => {
    // Synthetic response curve for UX; backend calculates exact values on submit
    const points = [] as Array<{ x: number; y: number }>;
    for (let x = 500; x <= 2500; x += 100) {
      const y = Math.max(200, Math.min(1200, auc24 * (x / (doseMg || 1)) * (intervalHr / (intervalHr || 12))));
      points.push({ x, y });
    }
    return points;
  }, [auc24, doseMg, intervalHr]);

  return (
    <Card>
      <CardHeader><CardTitle>AUC vs Dose</CardTitle></CardHeader>
      <CardContent>
        <div className="grid gap-3">
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={data} margin={{ left: 10, right: 10, top: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="x" tickFormatter={(v) => `${v} mg`} />
              <YAxis domain={[200, 1200]} />
              <Tooltip formatter={(v: number) => Math.round(v)} labelFormatter={(l) => `${l} mg`} />
              <ReferenceArea y1={targetLow} y2={targetHigh} fill="#22c55e" fillOpacity={0.15} />
              <Area type="monotone" dataKey="y" stroke="#2563eb" fill="#60a5fa" fillOpacity={0.3} />
            </AreaChart>
          </ResponsiveContainer>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Dose (mg)</div>
              <Slider value={[doseMg]} min={250} max={3000} step={50} onValueChange={([v]) => onChange({ doseMg: v })} />
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Interval (h)</div>
              <Slider value={[intervalHr]} min={4} max={48} step={1} onValueChange={([v]) => onChange({ intervalHr: v })} />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
