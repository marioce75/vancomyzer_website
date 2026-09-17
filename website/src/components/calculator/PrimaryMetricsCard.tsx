import React from "react";

interface PrimaryMetricsCardProps {
  auc24?: number | null;
  peak?: number | null;
  trough?: number | null;
  /**
   * Band variant for the desktop cockpit: three tight metric cells with the
   * AUC target and attainment status inline, so the clinician reads
   * dose → exposure → target in one horizontal sweep.
   */
  compact?: boolean;
  /** Caption above the metrics (e.g. "Steady-state PK — 1250 mg q12h"). */
  caption?: string | null;
}

function formatAuc(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return Number(value).toFixed(1);
}

function formatConc(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return Number(value).toFixed(2);
}

/** AUC₂₄ target attainment (2020 ASHP/IDSA/PIDS/SIDP consensus range). Display only. */
function aucStatus(auc: number | null | undefined): { label: string; cls: string; glyph: string } | null {
  if (auc == null || Number.isNaN(auc)) return null;
  if (auc >= 400 && auc <= 600) return { label: "Within target", cls: "vz-chip--ok", glyph: "✓" };
  if (auc > 600) return { label: "Above target", cls: "vz-chip--caution", glyph: "▲" };
  return { label: "Below target", cls: "vz-chip--warn", glyph: "▼" };
}

const Metric = ({ label, value, unit, compact, emphasis, sub }: { label: string; value: string; unit: string; compact?: boolean; emphasis?: boolean; sub?: React.ReactNode }) => (
  <div
    className={compact ? "px-2.5 py-1.5 min-w-0 h-full" : "px-3 py-2.5"}
    style={{
      border: `1px solid ${emphasis ? "var(--color-primary-a50)" : "var(--color-primary-a35)"}`,
      background: emphasis ? "var(--color-primary-a05)" : "var(--color-card)",
    }}
  >
    <span
      className={`${compact ? "text-[10px]" : "text-[10px]"} font-semibold uppercase tracking-[0.16em] block`}
      style={{ color: "var(--color-dim)", fontFamily: "'Share Tech Mono', monospace" }}
    >
      {label}
    </span>
    <div className={`${compact ? "mt-0.5" : "mt-1"} flex items-baseline gap-1`}>
      <span
        className={`${compact ? "text-[22px] leading-none" : "text-2xl"} font-bold tabular-nums mx-glow`}
        style={{
          color: "var(--color-primary)",
          fontFamily: "'Share Tech Mono', monospace",
          textShadow: "0 0 8px var(--color-glow)",
        }}
      >
        {value}
      </span>
      <span className="text-[11px]" style={{ color: "var(--color-dim)", fontFamily: "'Share Tech Mono', monospace" }}>{unit}</span>
    </div>
    {sub && <div className="mt-1">{sub}</div>}
  </div>
);

export default function PrimaryMetricsCard({ auc24, peak, trough, compact = false, caption }: PrimaryMetricsCardProps) {
  const status = aucStatus(auc24);
  if (compact) {
    return (
      <div className="flex min-w-0 flex-col gap-1">
        {caption && (
          <p className="vz-kicker m-0 truncate" style={{ fontFamily: "'Share Tech Mono', monospace" }}>{caption}</p>
        )}
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          <div className="col-span-2 sm:col-span-1">
          <Metric
            compact
            emphasis
            label="AUC₂₄"
            value={formatAuc(auc24)}
            unit="mg·h/L"
            sub={
              <span className="flex flex-wrap items-center gap-1.5">
                {status ? (
                  <span className={`vz-chip ${status.cls}`}><span aria-hidden="true">{status.glyph}</span> {status.label}</span>
                ) : (
                  <span className="vz-chip vz-chip--neutral">Target 400–600</span>
                )}
                {status && <span className="text-[10px]" style={{ color: "var(--color-dim)" }}>target 400–600</span>}
              </span>
            }
          />
          </div>
          <Metric compact label="Peak" value={formatConc(peak)} unit="mcg/mL" />
          <Metric compact label="Trough" value={formatConc(trough)} unit="mcg/mL" />
        </div>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      <Metric label="AUC24" value={formatAuc(auc24)} unit="mg·h/L" />
      <Metric label="Peak" value={formatConc(peak)} unit="mcg/mL" />
      <Metric label="Trough" value={formatConc(trough)} unit="mcg/mL" />
    </div>
  );
}
