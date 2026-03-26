"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ReferenceDot,
  ResponsiveContainer,
  Legend,
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
    xMin: 0,
    xMax: Math.max(24, ...x),
    yMax: Math.max(35, Math.ceil((Math.max(...y) * 1.2) / 5) * 5),
  };
}

// Detect approximate steady-state cycles (after 4-5 half-lives, ~3rd or 4th interval)
function buildChartData(curve: CurvePoint[]) {
  if (curve.length === 0) return [];
  // Find the interval by looking at the first trough-to-trough
  // Annotate each point with an aucShade value only from cycle 3 onwards (steady state)
  const xMax = Math.max(...curve.map((p) => p.time_hours));
  const ssStart = xMax * 0.5; // shade AUC from ~50% of total time onwards (approx steady state)
  return curve.map((p) => ({
    ...p,
    aucShade: p.time_hours >= ssStart ? p.concentration : null,
    aucShadeBase: p.time_hours >= ssStart ? 0 : null,
  }));
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string }>; label?: number }) => {
  if (!active || !payload?.length) return null;
  const conc = payload.find((p) => p.name === "Concentration")?.value;
  return (
    <div className="px-3 py-2 shadow-lg text-xs" style={{ background: "#000000", border: "1px solid rgba(0,255,65,0.5)", boxShadow: "0 0 12px rgba(0,255,65,0.2)", fontFamily: "'Share Tech Mono', monospace" }}>
      <p className="font-semibold mb-1" style={{ color: "#00a827" }}>t = {label}h</p>
      {conc != null && (
        <p className="tabular-nums" style={{ color: "#00ff41" }}>
          <span className="font-bold" style={{ color: "#00ff41", textShadow: "0 0 6px rgba(0,255,65,0.8)" }}>{Number(conc).toFixed(1)}</span> mcg/mL
        </p>
      )}
    </div>
  );
};

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
    return <div className="h-[260px] border border-dashed animate-pulse" style={{ borderColor: "rgba(0,255,65,0.3)", background: "#050505" }} />;
  }

  if (!hasData) {
    return (
      <div className="flex h-[260px] items-center justify-center border border-dashed text-sm" style={{ borderColor: "rgba(0,255,65,0.3)", background: "#050505", color: "#1a5c1a", fontFamily: "'Share Tech Mono', monospace" }}>
        &gt; CONCENTRATION-TIME PROJECTION APPEARS HERE AFTER CALCULATION<span className="mx-blink" style={{ color: "#00ff41" }}>_</span>
      </div>
    );
  }

  const { xMin, xMax, yMax } = getDomains(curveData, measuredData);
  const chartData = buildChartData(curveData.length > 0 ? curveData : measuredData);
  const modelLabel = calculationDetails?.method ?? "PK model";
  const evidenceLabel = calculationDetails?.evidence_strength ?? "";

  // Typical therapeutic reference lines for vancomycin
  const TROUGH_LOW = 10;
  const TROUGH_HIGH = 20;

  return (
    <div className="flex flex-col gap-2 w-full" aria-label="Concentration-time graph">
      {/* Legend / badges row */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="px-2.5 py-0.5 text-[11px] font-medium" style={{ border: "1px solid #003b00", background: "#000000", color: "#00a827", fontFamily: "'Share Tech Mono', monospace" }}>
          {modelLabel}
        </span>
        {evidenceLabel && (
          <span className="px-2.5 py-0.5 text-[11px] font-medium" style={{ border: "1px solid rgba(0,255,65,0.4)", background: "rgba(0,255,65,0.06)", color: "#00ff41", fontFamily: "'Share Tech Mono', monospace" }}>
            {evidenceLabel}
          </span>
        )}
        <span className="px-2.5 py-0.5 text-[11px] font-medium" style={{ border: "1px solid rgba(0,255,65,0.3)", background: "rgba(0,255,65,0.06)", color: "#00a827", fontFamily: "'Share Tech Mono', monospace" }}>
          ▓ Steady-state AUC zone
        </span>
        {measuredData.length > 0 && (
          <span className="px-2.5 py-0.5 text-[11px] font-medium" style={{ border: "1px solid rgba(255,51,51,0.4)", background: "rgba(255,51,51,0.08)", color: "#ff6666", fontFamily: "'Share Tech Mono', monospace" }}>
            ● {measuredData.length} measured level{measuredData.length === 1 ? "" : "s"}
          </span>
        )}
      </div>

      <div className="h-[240px] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 6, right: 16, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 4" stroke="rgba(0,255,65,0.08)" vertical={false} />

            <XAxis
              dataKey="time_hours"
              type="number"
              domain={[xMin, xMax]}
              tickFormatter={(v) => `${v}h`}
              tick={{ fontSize: 10, fill: "#1a5c1a", fontFamily: "'Share Tech Mono', monospace" }}
              stroke="#003b00"
              label={{ value: "Time (hours)", position: "insideBottomRight", offset: -4, fontSize: 10, fill: "#1a5c1a", fontFamily: "'Share Tech Mono', monospace" }}
            />
            <YAxis
              dataKey="concentration"
              type="number"
              domain={[0, yMax]}
              tick={{ fontSize: 10, fill: "#1a5c1a", fontFamily: "'Share Tech Mono', monospace" }}
              stroke="#003b00"
              label={{ value: "mcg/mL", angle: -90, position: "insideLeft", offset: 8, fontSize: 10, fill: "#1a5c1a", fontFamily: "'Share Tech Mono', monospace" }}
            />

            <Tooltip content={<CustomTooltip />} />

            {/* Therapeutic trough range band — Matrix green reference lines */}
            <ReferenceLine
              y={TROUGH_HIGH}
              stroke="#00a827"
              strokeDasharray="5 3"
              strokeWidth={1.5}
              label={{ value: `Trough max ${TROUGH_HIGH}`, position: "right", fontSize: 9, fill: "#00a827", fontFamily: "'Share Tech Mono', monospace" }}
            />
            <ReferenceLine
              y={TROUGH_LOW}
              stroke="#00a827"
              strokeDasharray="5 3"
              strokeWidth={1.5}
              label={{ value: `Trough min ${TROUGH_LOW}`, position: "right", fontSize: 9, fill: "#00a827", fontFamily: "'Share Tech Mono', monospace" }}
            />

            {/* Steady-state AUC shaded area */}
            <Area
              type="monotone"
              dataKey="aucShade"
              stroke="none"
              fill="#00ff41"
              fillOpacity={0.06}
              isAnimationActive={false}
              legendType="none"
            />

            {/* Main concentration line */}
            <Line
              type="monotone"
              dataKey="concentration"
              name="Concentration"
              stroke="#00ff41"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4, fill: "#00ff41", stroke: "#000000", strokeWidth: 2 }}
              isAnimationActive={false}
            />

            {/* Measured levels as Matrix-styled dots */}
            {measuredData.map((p, i) => (
              <ReferenceDot
                key={i}
                x={p.time_hours}
                y={p.concentration}
                r={5}
                fill="#00ff41"
                stroke="#000000"
                strokeWidth={2}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Compact legend + reference link */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="flex flex-wrap gap-3 text-[10px]" style={{ color: "#1a5c1a", fontFamily: "'Share Tech Mono', monospace" }}>
          <span className="flex items-center gap-1"><span className="inline-block w-5 h-0.5" style={{ background: "#00ff41" }}></span> Predicted concentration</span>
          <span className="flex items-center gap-1"><span className="inline-block w-5 h-0.5 border-t-2 border-dashed" style={{ borderColor: "#00a827" }}></span> Trough reference (10–20 mcg/mL)</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3" style={{ background: "rgba(0,255,65,0.2)", border: "1px solid rgba(0,255,65,0.4)" }}></span> Steady-state AUC zone</span>
          {measuredData.length > 0 && <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5" style={{ background: "#00ff41", border: "1px solid #000000" }}></span> Measured level</span>}
        </div>
        <Link
          href="/references"
          className="text-[10px] transition-colors shrink-0"
          style={{ color: "#00a827", fontFamily: "'Share Tech Mono', monospace" }}
        >
          References &amp; Methods
        </Link>
      </div>
    </div>
  );
}
