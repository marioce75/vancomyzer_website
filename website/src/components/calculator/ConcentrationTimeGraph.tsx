"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceDot,
} from "recharts";
import type { CalculationDetails } from "@/types/calculator";

interface CurvePoint {
  time_hours: number;
  concentration: number;
}

interface ConcentrationTimeGraphProps {
  curve?: CurvePoint[] | null;
  measured_levels?: CurvePoint[] | null;
  calculationDetails?: CalculationDetails | null;
}

function getDomains(curve: CurvePoint[], measuredLevels: CurvePoint[]) {
  const all = [...curve, ...measuredLevels];
  if (all.length === 0) return { xMin: 0, xMax: 24, yMax: 35 };
  const x = all.map((p) => p.time_hours);
  const y = all.map((p) => p.concentration);
  return {
    xMin: Math.min(0, ...x),
    xMax: Math.max(24, ...x),
    yMax: Math.max(35, Math.ceil((Math.max(...y) * 1.15) / 5) * 5),
  };
}

export default function ConcentrationTimeGraph({
  curve,
  measured_levels,
  calculationDetails,
}: ConcentrationTimeGraphProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const curveData = curve ?? [];
  const measuredData = measured_levels ?? [];
  const hasData = curveData.length > 0 || measuredData.length > 0;

  if (!mounted) {
    return <div className="h-[320px] rounded-xl border border-dashed border-slate-300 bg-slate-50" />;
  }

  if (!hasData) {
    return (
      <div className="flex h-[320px] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500">
        Concentration-time projection appears here after calculation.
      </div>
    );
  }

  const { xMin, xMax, yMax } = getDomains(curveData, measuredData);
  const data = curveData.length > 0 ? curveData : measuredData;
  const modelLabel = calculationDetails?.method ?? "PK model output";
  const evidenceLabel = calculationDetails?.evidence_strength ?? "workflow-specific evidence";

  return (
    <div className="flex h-full min-h-[320px] w-full min-w-0 flex-col gap-4" aria-label="Concentration-time graph">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
          {modelLabel}
        </span>
        <span className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-medium text-cyan-800">
          {evidenceLabel}
        </span>
        <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700">
          {curveData.length > 0 ? "Predicted profile" : "Measured points only"}
        </span>
        {measuredData.length > 0 && (
          <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700">
            {measuredData.length} measured level{measuredData.length === 1 ? "" : "s"}
          </span>
        )}
      </div>
      <div className="h-[320px] min-w-0 w-full">
        <ResponsiveContainer width="100%" height="100%" minWidth={320}>
          <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="time_hours" type="number" domain={[xMin, xMax]} tickFormatter={(v) => `${v}h`} tick={{ fontSize: 11 }} stroke="#64748b" />
          <YAxis dataKey="concentration" type="number" domain={[0, yMax]} tick={{ fontSize: 11 }} stroke="#64748b" label={{ value: "mcg/mL", angle: -90, position: "insideLeft", style: { fontSize: 11 } }} />
          <Tooltip formatter={(value) => [`${Number(value).toFixed(1)} mcg/mL`, "Concentration"]} labelFormatter={(label) => `Time ${label} h`} contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }} />
          {curveData.length > 0 && <Line type="monotone" dataKey="concentration" stroke="#0f172a" activeDot={{ r: 4, fill: "#0f172a" }} strokeWidth={2.25} dot={false} isAnimationActive={false} />}
          {measuredData.map((p, i) => <ReferenceDot key={i} x={p.time_hours} y={p.concentration} r={5} fill="#dc2626" stroke="#fff" strokeWidth={1} />)}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
        AUC24 target attainment is calculated from the PK model output and reviewed numerically alongside peak and trough. No flat concentration target band is drawn, because that would misrepresent exposure guidance as a constant concentration goal.
      </div>
    </div>
  );
}
