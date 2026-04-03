"use client";

import React, { useState } from "react";
import { CalculationDetails, FrequencyOption, AucRangeStatus, ArcAdvisory } from "@/types/calculator";

interface DoseRecommendationCardProps {
  recommended_dose?: string | null;
  recommended_interval_hours?: number | null;
  recommended_infusion_duration_hours?: number | null;
  infusion_duration_adjusted_for_safety?: boolean;
  infusion_safety_note?: string | null;
  recommendation_type?: "initial_regimen" | "existing_regimen" | null;
  calculationDetails?: CalculationDetails | null;
  frequency_options?: FrequencyOption[] | null;
  draftDiffersFromCalculated?: boolean;
  onApplyRecommendation?: (() => void) | null;
  onApplyFrequency?: ((option: FrequencyOption) => void) | null;
  onSelectFrequency?: ((option: FrequencyOption) => void) | null;
  onSimulateLoadingDose?: ((doseMg: number, intervalHours: number, infusionHours: number) => void) | null;
  patientWeightKg?: number | null;
  auc_range_status?: AucRangeStatus | null;
  arc_advisory?: ArcAdvisory | null;
  auc24?: number | null;
  isPulseDose?: boolean;
  loadingDoseMg?: number | null;
}

const FONT: React.CSSProperties = { fontFamily: "'Share Tech Mono', monospace" };

function LoadingDoseGuidance({ doseMg, weightKg, onSimulate }: { doseMg: number; weightKg: number | null; onSimulate?: ((doseMg: number, intervalHours: number, infusionHours: number) => void) | null }) {
  const [expanded, setExpanded] = React.useState(false);
  // Standard loading dose: 25-30 mg/kg actual body weight (ASHP/IDSA 2020)
  // Max single loading dose: 3000 mg
  // Infusion rate: ≤10 mg/min (or 1g per 60 min minimum)
  const wt = weightKg ?? 75; // fallback for display
  const loadLow = Math.round(wt * 25 / 250) * 250; // round to nearest 250
  const loadHigh = Math.min(3000, Math.round(wt * 30 / 250) * 250);
  const loadSuggested = Math.min(3000, Math.round(wt * 25 / 250) * 250);
  const infusionMinutes = Math.max(60, Math.ceil(loadSuggested / 10)); // ≤10 mg/min

  return (
    <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: 8 }}>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 w-full text-left"
        style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0, ...FONT }}
      >
        <svg
          width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          style={{ color: "var(--color-dim)", transition: "transform 0.2s", transform: expanded ? "rotate(90deg)" : "rotate(0deg)" }}
        >
          <path d="M9 5l7 7-7 7" />
        </svg>
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--color-secondary)", letterSpacing: "0.08em", ...FONT }}>
          SUGGESTED LOADING DOSE
        </span>
      </button>

      {expanded && (
        <div style={{ marginTop: 8, padding: "8px 10px", background: "var(--color-bg)", border: "1px solid var(--color-border)", ...FONT }}>
          <div className="flex items-baseline gap-2">
            <span style={{ fontSize: 20, fontWeight: 700, color: "var(--color-primary)", textShadow: "0 0 8px var(--color-glow)", ...FONT }}>
              {loadSuggested}
            </span>
            <span style={{ fontSize: 12, color: "var(--color-secondary)", ...FONT }}>mg</span>
            <span style={{ fontSize: 10, color: "var(--color-dim)", ...FONT }}>({loadLow}–{loadHigh} mg range)</span>
          </div>

          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
            <p style={{ fontSize: 10, color: "var(--color-dim)", margin: 0, ...FONT }}>
              <span style={{ color: "var(--color-secondary)" }}>WHEN:</span> Consider when rapid therapeutic levels are needed — severe infections (endocarditis, meningitis, bacteremia) or critically ill patients where delayed attainment increases mortality risk.
            </p>
            <p style={{ fontSize: 10, color: "var(--color-dim)", margin: 0, ...FONT }}>
              <span style={{ color: "var(--color-secondary)" }}>DOSE:</span> 25–30 mg/kg actual body weight. Calculated: 25 mg/kg × {wt} kg = {Math.round(wt * 25)} mg → rounded to <span style={{ color: "var(--color-primary)" }}>{loadSuggested} mg</span>.
            </p>
            <p style={{ fontSize: 10, color: "var(--color-dim)", margin: 0, ...FONT }}>
              <span style={{ color: "var(--color-secondary)" }}>INFUSION:</span> Max rate 10 mg/min (FDA/ASHP). {loadSuggested} mg infused over ≥{infusionMinutes} min to reduce Red Man Syndrome risk.
            </p>
            <p style={{ fontSize: 10, color: "var(--color-dim)", margin: 0, ...FONT }}>
              <span style={{ color: "var(--color-secondary)" }}>MAX:</span> 3,000 mg single dose. If calculated dose exceeds 3,000 mg, cap at 3,000 mg.
            </p>
          </div>

          <p style={{ fontSize: 9, color: "var(--color-dim)", fontStyle: "italic", marginTop: 8, ...FONT }}>
            ASHP/IDSA/SIDP 2020: Loading doses of 25–30 mg/kg (based on actual body weight) can be used to facilitate rapid attainment of target AUC₂₄/MIC.
          </p>

          {onSimulate && (
            <button
              type="button"
              onClick={() => {
                const infHours = Math.max(1, Math.ceil(loadSuggested / 600 * 4) / 4); // round up to 0.25h, min 1h
                onSimulate(loadSuggested, 12, infHours);
              }}
              className="mt-3 w-full py-2 text-xs font-bold uppercase tracking-wider transition-colors"
              style={{
                background: "var(--color-primary)",
                color: "var(--color-card)",
                border: "none",
                cursor: "pointer",
                letterSpacing: "0.1em",
              }}
            >
              SIMULATE LOADING DOSE PK →
            </button>
          )}
        </div>
      )}

      {/* Clinical guidance — inside the expanded block */}
      {expanded && (
        <div style={{ marginTop: 8, padding: "10px 14px", borderLeft: "2px solid #004422", ...FONT }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: "var(--color-primary)", letterSpacing: "2px", margin: 0, ...FONT }}>
            {">"} LOADING DOSE GUIDANCE
          </p>
          <p style={{ fontSize: 10, color: "var(--color-secondary)", lineHeight: 1.7, marginTop: 6, ...FONT }}>
            Administer loading dose prior to first maintenance dose.{"\n"}
            Draw first level 1.5–6h post-infusion end for early Bayesian{"\n"}
            estimation, or peak + trough near dose 3–4 for highest accuracy.{"\n"}
            Renal function and SCr should be reassessed within 24–48h.{"\n"}
            Target AUC₂₄ 400–600 mg·h/L within 48h of initiation.
          </p>
        </div>
      )}
    </div>
  );
}

function aucRangeLabel(auc: number): { label: string; color: string; badgeStyle: React.CSSProperties } {
  if (auc >= 400 && auc <= 600) return {
    label: "In range",
    color: "text-emerald-700 bg-emerald-50 border-emerald-200",
    badgeStyle: { background: "#ecfdf5", borderColor: "#6ee7b7", color: "#047857" },
  };
  if (auc > 600) return {
    label: "Above target",
    color: "text-amber-700 bg-amber-50 border-amber-200",
    badgeStyle: { background: "#fffbeb", borderColor: "#fcd34d", color: "#92400e" },
  };
  return {
    label: "Below target",
    color: "text-rose-700 bg-rose-50 border-rose-200",
    badgeStyle: { background: "#fff1f2", borderColor: "#fca5a5", color: "#991b1b" },
  };
}

export default function DoseRecommendationCard({
  recommended_dose,
  recommended_interval_hours,
  recommended_infusion_duration_hours,
  infusion_safety_note,
  calculationDetails,
  frequency_options,
  draftDiffersFromCalculated,
  onApplyRecommendation,
  onApplyFrequency,
  onSelectFrequency,
  onSimulateLoadingDose,
  patientWeightKg,
  auc_range_status,
  arc_advisory,
  auc24: rawAuc24,
  isPulseDose,
  loadingDoseMg,
}: DoseRecommendationCardProps) {
  // Show all options with dose >= 500mg — include below-target options so user can see the best available
  const options = frequency_options?.filter(
    (o) => o.dose_mg >= 500
  ) ?? [];

  const [activeIdx, setActiveIdx] = useState<number>(() => {
    if (!recommended_dose || !recommended_interval_hours) return 0;
    const recDose = Number.parseFloat(recommended_dose);
    const idx = options.findIndex(
      (o) => o.dose_mg === recDose && o.interval_hours === recommended_interval_hours
    );
    return idx >= 0 ? idx : 0;
  });

  if (!recommended_dose || !recommended_interval_hours) return null;

  const active = options[activeIdx] ?? null;
  const displayDose = active ? String(active.dose_mg) : recommended_dose;
  const displayInterval = active ? active.interval_hours : recommended_interval_hours;
  const displayInfusionHours = active?.infusion_duration_hours ?? recommended_infusion_duration_hours ?? 1;
  // Show AUC from active option, or fall back to the raw auc24 from the response
  const displayAUC = active?.auc24 ?? rawAuc24 ?? null;
  const range = displayAUC != null ? aucRangeLabel(displayAUC) : null;

  const subline = `Infuse over ${displayInfusionHours} hour${displayInfusionHours === 1 ? "" : "s"}.`;

  return (
    <div className="flex flex-col gap-3">
      {/* Frequency tabs — horizontal scrollable */}
      {options.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
          {options.map((opt, idx) => {
            const r = aucRangeLabel(opt.auc24);
            const isActive = idx === activeIdx;
            return (
              <button
                key={`${opt.dose_mg}-q${opt.interval_hours}`}
                type="button"
                onClick={() => {
                  setActiveIdx(idx);
                  onSelectFrequency?.(opt);
                }}
                className="shrink-0 flex flex-col items-center border px-3 py-2 text-center text-xs transition"
                style={
                  isActive
                    ? { background: "var(--color-primary)", borderColor: "var(--color-primary)", color: "var(--color-bg)", fontFamily: "'Share Tech Mono', monospace" }
                    : { background: "var(--color-bg)", borderColor: "var(--color-border)", color: "var(--color-secondary)", fontFamily: "'Share Tech Mono', monospace" }
                }
              >
                <span className="font-bold tabular-nums text-sm" style={isActive ? { color: "var(--color-bg)" } : { color: "var(--color-primary)", fontFamily: "'Share Tech Mono', monospace" }}>
                  {opt.dose_mg} mg
                </span>
                <span className="font-medium" style={isActive ? { color: "var(--color-bg)" } : { color: "var(--color-dim)", fontFamily: "'Share Tech Mono', monospace" }}>
                  q{opt.interval_hours}h
                </span>
                <span
                  className="mt-1 inline-flex border px-1.5 py-0.5 text-[10px] font-semibold leading-none"
                  style={isActive
                    ? { borderColor: "rgba(0,0,0,0.3)", background: "rgba(0,0,0,0.15)", color: "var(--color-bg)" }
                    : { ...r.badgeStyle }
                  }
                >
                  {r.label}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Loading dose label — shown above maintenance recommendation */}
      {isPulseDose && loadingDoseMg && (
        <div className="px-4 py-2 rounded-lg border" style={{ borderColor: "#6ee7b7", background: "#ecfdf5" }}>
          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "#047857", ...FONT }}>
            LOADING DOSE: {loadingDoseMg} mg (single dose)
          </span>
          <p className="mt-1 text-[10px]" style={{ color: "#065f46", margin: 0, ...FONT }}>
            Curve below shows first-dose PK. The following is the suggested maintenance regimen to follow:
          </p>
        </div>
      )}

      {/* Active dose display */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div
            className="px-4 py-3"
            style={{
              background: "var(--color-bg)",
              border: "1px solid var(--color-primary-a40)",
              boxShadow: "0 0 16px var(--color-primary-a06)",
            }}
          >
            {isPulseDose && (
              <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "var(--color-dim)", margin: "0 0 4px 0", ...FONT }}>
                SUGGESTED MAINTENANCE REGIMEN
              </p>
            )}
            <div className="flex flex-wrap items-baseline gap-x-1.5">
              <span
                className="text-4xl font-extrabold tabular-nums mx-glow"
                style={{ color: "var(--color-primary)", fontFamily: "'Share Tech Mono', monospace", textShadow: "0 0 12px var(--color-glow-strong)" }}
              >
                {displayDose}
              </span>
              <span className="text-xl font-semibold" style={{ color: "var(--color-secondary)", fontFamily: "'Share Tech Mono', monospace" }}>mg</span>
              <span className="text-base font-medium mx-1" style={{ color: "var(--color-dim)", fontFamily: "'Share Tech Mono', monospace" }}>every</span>
              <span
                className="text-4xl font-extrabold tabular-nums mx-glow"
                style={{ color: "var(--color-primary)", fontFamily: "'Share Tech Mono', monospace", textShadow: "0 0 12px var(--color-glow-strong)" }}
              >
                {displayInterval}
              </span>
              <span className="text-xl font-semibold" style={{ color: "var(--color-secondary)", fontFamily: "'Share Tech Mono', monospace" }}>h</span>
            </div>
            <p className="mt-1 text-xs" style={{ color: "var(--color-dim)", fontFamily: "'Share Tech Mono', monospace" }}>{subline}</p>
            {displayAUC != null && range && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs" style={{ color: "var(--color-dim)", fontFamily: "'Share Tech Mono', monospace" }}>AUC24</span>
                <span className="tabular-nums text-sm font-bold" style={{ color: "var(--color-primary)", fontFamily: "'Share Tech Mono', monospace" }}>{displayAUC}</span>
                <span className="text-xs" style={{ color: "var(--color-dim)", fontFamily: "'Share Tech Mono', monospace" }}>mg·h/L</span>
                <span className="inline-flex border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider" style={{ ...range.badgeStyle }}>
                  {range.label}
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          {draftDiffersFromCalculated && onApplyRecommendation && (
            <button
              type="button"
              onClick={onApplyRecommendation}
              className="px-3 py-1.5 text-xs font-semibold transition"
              style={{ border: "1px solid var(--color-primary-a40)", background: "var(--color-primary-a05)", color: "var(--color-secondary)", fontFamily: "'Share Tech Mono', monospace" }}
            >
              [APPLY RECOMMENDED]
            </button>
          )}
        </div>
      </div>

      {/* ARC Advisory — critical patient safety warning */}
      {arc_advisory?.detected && (
        <div className="rounded-lg border-2 px-4 py-3" style={{ borderColor: "#dc2626", background: "#fef2f2" }}>
          <p className="text-sm font-bold" style={{ color: "#991b1b", margin: 0 }}>
            ⚠ AUGMENTED RENAL CLEARANCE DETECTED
          </p>
          <div className="mt-2 space-y-1.5 text-xs" style={{ color: "#7f1d1d" }}>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <span><strong>CrCl:</strong> {arc_advisory.crcl_ml_min} mL/min</span>
              <span><strong>CL:</strong> {arc_advisory.cl_l_h} L/h</span>
              <span><strong>Required TDD:</strong> ~{arc_advisory.required_tdd_mg?.toLocaleString()} mg/day</span>
            </div>
            <p style={{ margin: 0, lineHeight: 1.6 }}>
              Standard intermittent dosing cannot achieve target AUC₂₄ of 400–600 mg·h/L with this clearance.
            </p>
            <div style={{ margin: 0, lineHeight: 1.6 }}>
              <strong>Clinical options:</strong>
              <ul style={{ margin: "4px 0 0 16px", padding: 0, listStyleType: "disc" }}>
                <li>Continuous IV infusion: ~{arc_advisory.continuous_infusion_rate_mg_h} mg/hour (administer loading dose first)</li>
                <li>Consult Infectious Diseases and/or nephrology</li>
                <li>Obtain two vancomycin levels early (2–4h and 6–8h post-dose) to confirm individual PK parameters before proceeding</li>
              </ul>
            </div>
            <p style={{ margin: 0, fontSize: 10, fontStyle: "italic" }}>
              Reference: ASHP/IDSA/SIDP 2020 Guidelines — Augmented Renal Clearance
            </p>
          </div>
        </div>
      )}

      {/* Below-target warning (non-ARC) */}
      {!arc_advisory?.detected && auc_range_status === "below_target" && rawAuc24 != null && (
        <div className="rounded-lg border px-4 py-3" style={{ borderColor: "#fca5a5", background: "#fff1f2" }}>
          <p className="text-sm font-bold" style={{ color: "#991b1b", margin: 0 }}>
            AUC₂₄ BELOW TARGET
          </p>
          <p className="mt-1 text-xs" style={{ color: "#7f1d1d", margin: 0 }}>
            Best available regimen achieves AUC₂₄ of {rawAuc24} mg·h/L, which is below the target range of 400–600 mg·h/L. Clinical review is required — consider more frequent dosing, higher doses, or continuous infusion.
          </p>
        </div>
      )}

      {infusion_safety_note && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
          <strong>Note:</strong> {infusion_safety_note}{" "}
          <span style={{ fontSize: 10 }}>
            [<a href="https://www.accessdata.fda.gov/drugsatfda_docs/label/2017/050671s023lbl.pdf" target="_blank" rel="noopener noreferrer" className="underline hover:no-underline" style={{ color: "inherit" }}>FDA Label</a>{" · "}
            <a href="https://pubmed.ncbi.nlm.nih.gov/32191793/" target="_blank" rel="noopener noreferrer" className="underline hover:no-underline" style={{ color: "inherit" }}>ASHP/IDSA 2020</a>]
          </span>
        </div>
      )}

      {/* Loading dose guidance — patient-specific */}
      {active && (
        <LoadingDoseGuidance doseMg={active.dose_mg} weightKg={patientWeightKg ?? null} onSimulate={onSimulateLoadingDose} />
      )}

      {calculationDetails?.review_status?.banner_body && (
        <div className="text-xs leading-5 pt-2" style={{ color: "var(--color-dim)", borderTop: "1px solid var(--color-border)", fontFamily: "'Share Tech Mono', monospace" }}>
          <p style={{ margin: 0 }}>{calculationDetails.review_status.banner_body}</p>
          <p style={{ margin: "4px 0 0 0" }}>Draw first level 1.5–6h post-infusion end (dose 1 acceptable) or peak + trough near dose 3–4 for highest AUC accuracy — target AUC₂₄ 400–600 mg·h/L within 48h per ASHP/IDSA 2020.</p>
        </div>
      )}
    </div>
  );
}
