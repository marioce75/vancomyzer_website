"use client";

import type { FrequencyOption } from "@/types/calculator";
import { aucRangeLabel } from "@/components/calculator/DoseRecommendationCard";
import { fmt } from "@/lib/formatNumber";

/**
 * Compact, selectable comparison of the engine's candidate regimens.
 *
 * Presentation only: the rows are the engine's `frequency_options` filtered
 * with the same rule the dose card has always used (dose ≥ 500 mg and AUC₂₄
 * ≤ 600 — above-target candidates are never offered). Selecting a row updates
 * the workspace's single active option, which drives the band and the graph.
 *
 * On the existing-regimen path the first row is the CURRENT regimen as
 * entered (the response's top-level auc24/peak/trough describe it); selecting
 * it clears the option selection so the graph shows the current-regimen curve.
 */

export interface CurrentRegimenRow {
  dose_mg: number;
  interval_hours: number;
  auc24: number;
  peak: number;
  trough: number;
  /** Row tag, e.g. "current" or "loading dose". */
  label?: string;
  /**
   * A single loading dose: the figures are that one dose over its first 24 h,
   * not a steady-state regimen, so the row is shown as "× 1" and is not graded
   * against the 400–600 steady-state target.
   */
  single_dose?: boolean;
}

interface RegimenComparisonTableProps {
  options: FrequencyOption[] | null | undefined;
  /** The option currently driving the band and graph (null = none / current regimen). */
  activeOption: FrequencyOption | null;
  onSelect: (option: FrequencyOption | null) => void;
  /** Existing-regimen path: the regimen as entered, shown as a selectable reference row. */
  current?: CurrentRegimenRow | null;
  /** Optional per-row apply action ("use this regimen as the draft"). */
  onApply?: ((option: FrequencyOption) => void) | null;
}

const MONO = { fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)" } as const;

function statusChip(auc: number) {
  const r = aucRangeLabel(auc);
  const inRange = auc >= 400 && auc <= 600;
  const cls = inRange ? "vz-chip--ok" : auc > 600 ? "vz-chip--caution" : "vz-chip--warn";
  const short = inRange ? "In range" : auc > 600 ? "High" : "Low";
  return (
    <span className={`vz-chip ${cls}`} title={`${r.label}: AUC₂₄ ${auc} mg·h/L (target 400–600)`} style={{ padding: "0 5px", fontSize: 10 }}>
      {short}<span className="sr-only"> ({r.label})</span>
    </span>
  );
}

export default function RegimenComparisonTable({ options, activeOption, onSelect, current, onApply }: RegimenComparisonTableProps) {
  // Same display rule the dose card has always used, plus the engine's own
  // recommendation, which is never hidden from the comparison.
  const rows = (options ?? []).filter((o) => o.is_recommended || (o.dose_mg >= 500 && o.auc24 <= 600));
  const recommendedOutsideRule = rows.some((o) => o.is_recommended && !(o.dose_mg >= 500 && o.auc24 <= 600));
  if (rows.length === 0 && !current) return null;

  const isActive = (o: FrequencyOption) =>
    activeOption != null && activeOption.dose_mg === o.dose_mg && activeOption.interval_hours === o.interval_hours;
  const currentActive = current != null && activeOption == null;

  const handleKey = (e: React.KeyboardEvent, fn: () => void) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fn(); }
  };

  return (
    <div className="overflow-x-auto">
      <table className="vz-table" role="radiogroup" aria-label="Candidate regimens">
        <thead>
          <tr>
            <th scope="col">Regimen</th>
            <th scope="col" title="Predicted steady-state AUC₂₄ (mg·h/L)">AUC₂₄</th>
            <th scope="col" title="Predicted peak (mcg/mL)">Peak</th>
            <th scope="col" title="Predicted trough (mcg/mL)">Trough</th>
            <th scope="col">Target</th>
          </tr>
        </thead>
        <tbody>
          {current && (
            <tr
              role="radio"
              aria-checked={currentActive}
              tabIndex={0}
              onClick={() => onSelect(null)}
              onKeyDown={(e) => handleKey(e, () => onSelect(null))}
            >
              <td>
                <span className="font-semibold" style={MONO}>{current.single_dose ? `${current.dose_mg} mg × 1` : `${current.dose_mg} mg q${current.interval_hours}h`}</span>
                <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-dim)" }}>{current.label ?? "current"}</span>
              </td>
              <td style={MONO}>{current.auc24.toFixed(0)}</td>
              <td style={MONO}>{fmt(current.peak, 1)}</td>
              <td style={MONO}>{fmt(current.trough, 1)}</td>
              <td>
                {current.single_dose ? (
                  <span className="vz-chip vz-chip--neutral" title="Single dose, first 24 h — not graded against the steady-state target" style={{ padding: "0 5px", fontSize: 10 }}>First 24 h</span>
                ) : statusChip(current.auc24)}
              </td>
            </tr>
          )}
          {rows.map((o) => {
            const active = isActive(o);
            return (
              <tr
                key={`${o.dose_mg}-${o.interval_hours}`}
                role="radio"
                aria-checked={active}
                tabIndex={0}
                onClick={() => onSelect(o)}
                onKeyDown={(e) => handleKey(e, () => onSelect(o))}
              >
                <td>
                  <span className="font-semibold" style={MONO}>{o.dose_mg} mg q{o.interval_hours}h</span>
                  {o.is_recommended && (
                    <span className="block text-[9px] font-semibold" style={{ color: "var(--color-primary)" }} title="Suggested regimen">Recommended</span>
                  )}
                  {o.is_recommended && !(o.dose_mg >= 500 && o.auc24 <= 600) && (
                    <span className="ml-1 vz-chip vz-chip--caution" style={{ padding: "0 4px", fontSize: 9 }} title="Outside the candidate display rule (dose ≥ 500 mg, AUC₂₄ ≤ 600)">review</span>
                  )}
                </td>
                <td style={MONO}>{o.auc24.toFixed(0)}</td>
                <td style={MONO}>{fmt(o.peak, 1)}</td>
                <td style={MONO}>{fmt(o.trough, 1)}</td>
                <td>{statusChip(o.auc24)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="flex items-start justify-between gap-2 px-2 pt-1.5">
        <p className="m-0 text-[10px] leading-4" style={{ color: "var(--color-dim)" }}>
          {current?.single_dose ? "Loading-dose row: that single dose over its first 24 h. Other rows: " : ""}Steady-state predictions from the same PK parameters. Candidates with AUC₂₄ above 600 or doses below 500 mg are not offered{recommendedOutsideRule ? "; the calculator's recommendation is always listed and flagged when it falls outside that rule" : ""}.
        </p>
        {onApply && activeOption && (
          <button
            type="button"
            onClick={() => onApply(activeOption)}
            className="shrink-0 rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
            style={{ borderColor: "#1f5e96", color: "#14232f", background: "#fff", cursor: "pointer" }}
            title="Copy the selected regimen into the dosing-history draft"
          >
            Use as draft
          </button>
        )}
      </div>
    </div>
  );
}
