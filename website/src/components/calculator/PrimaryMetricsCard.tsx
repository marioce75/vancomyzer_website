import React from "react";

interface PrimaryMetricsCardProps {
  auc24?: number | null;
  peak?: number | null;
  trough?: number | null;
}

function formatMetric(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return Number(value).toFixed(1).replace(/\.0$/, "");
}

const Metric = ({ label, value, unit }: { label: string; value: string; unit: string }) => (
  <div
    className="px-3 py-2.5"
    style={{
      border: "1px solid rgba(0,255,65,0.35)",
      background: "#050505",
    }}
  >
    <span
      className="text-[10px] font-medium uppercase tracking-[0.2em] block"
      style={{ color: "#1a5c1a", fontFamily: "'Share Tech Mono', monospace" }}
    >
      {label}
    </span>
    <div className="mt-1 flex items-baseline gap-1">
      <span
        className="text-2xl font-bold tabular-nums mx-glow"
        style={{
          color: "#00ff41",
          fontFamily: "'Share Tech Mono', monospace",
          textShadow: "0 0 8px rgba(0,255,65,0.7)",
        }}
      >
        {value}
      </span>
      <span className="text-xs" style={{ color: "#1a5c1a", fontFamily: "'Share Tech Mono', monospace" }}>{unit}</span>
    </div>
  </div>
);

export default function PrimaryMetricsCard({ auc24, peak, trough }: PrimaryMetricsCardProps) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      <Metric label="AUC24" value={formatMetric(auc24)} unit="mg·h/L" />
      <Metric label="Peak" value={formatMetric(peak)} unit="mcg/mL" />
      <Metric label="Trough" value={formatMetric(trough)} unit="mcg/mL" />
    </div>
  );
}
