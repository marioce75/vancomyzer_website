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
  /**
   * Predicted exposure of the regimen being recommended. On the existing-regimen
   * path `auc24` is the CURRENT regimen's exposure, so the below-target banner
   * must quote this instead or it states the wrong number.
   */
  predicted_auc24?: number | null;
  isPulseDose?: boolean;
  loadingDoseMg?: number | null;
  onUndoLoadingDose?: (() => void);
  /** When set, replaces the standard dose card with a pulse-dose safety state. */
  empiricDosingBlocked?: {
    reason: string;
    recommended_pulse_dose_mg: number;
    safety_message: string;
    estimated_cl_l_h: number;
  } | null;
  /** When set, replaces the standard dose card with a hold-and-recheck safety state. */
  adjustmentDosingBlocked?: {
    reason: string;
    recommended_action: string;
    safety_message: string;
    estimated_cl_l_h: number;
  } | null;
  /**
   * Controlled selection. When provided, the displayed regimen follows this
   * option (the workspace's single source of truth) instead of the card's own
   * tab state, so the comparison table, graph and band stay in sync.
   */
  activeOption?: FrequencyOption | null;
  /** The controlled option is the CURRENT regimen as entered (existing-regimen path), not a recommendation. */
  activeIsCurrent?: boolean;
  /** Render the inline frequency tabs. Off when a comparison table shows the options instead. */
  showOptionTabs?: boolean;
  /**
   * "band": horizontal recommendation band for the desktop cockpit — the dose
   * block sits beside `metricsSlot`; advisories flow beneath. "card": legacy stacked card.
   */
  layout?: "card" | "band";
  /** Exposure metrics rendered beside the dose block in band layout. */
  metricsSlot?: React.ReactNode;
  /** Render the inline loading-dose expander (off when the band header hosts the popover). */
  showLoadingDose?: boolean;
}

const FONT: React.CSSProperties = { fontFamily: "'Share Tech Mono', monospace" };

interface LoadingDoseConfiguratorProps {
  weightKg: number | null;
  onSimulate?: ((doseMg: number, intervalHours: number, infusionHours: number) => void) | null;
}

/**
 * Loading-dose configurator panel (guideline weight-based estimate, editable
 * dose, auto infusion duration, simulate). Same arithmetic as before; only
 * the container changed so it can live inline or in a popover.
 */
export function LoadingDoseConfigurator({ weightKg, onSimulate }: LoadingDoseConfiguratorProps) {
  const wt = weightKg ?? 75;
  const defaultDose = Math.min(3000, Math.round(wt * 25 / 250) * 250);
  const loadLow = Math.round(wt * 25 / 250) * 250;
  const loadHigh = Math.min(3000, Math.round(wt * 30 / 250) * 250);

  // Editable loading dose
  const [customDose, setCustomDose] = React.useState(defaultDose);

  // Auto-calculate infusion duration (≤10 mg/min, min 60 min)
  const infusionMinutes = Math.max(60, Math.ceil(customDose / 10));
  const infusionHours = Math.max(1, Math.ceil(infusionMinutes / 60 * 4) / 4);
  const rateExceeded = customDose / infusionMinutes > 10;

  // Update default dose when weight changes
  React.useEffect(() => { setCustomDose(defaultDose); }, [defaultDose]);

  return (
    <div style={{ padding: "12px 14px", background: "var(--color-bg)", border: "1px solid var(--color-border)", ...FONT }}>
      {/* Clinical context */}
      <p style={{ fontSize: 10, color: "var(--color-dim)", margin: "0 0 10px", lineHeight: 1.6, ...FONT }}>
        Consider when rapid therapeutic levels are needed — severe infections or critically ill patients.
        ASHP/IDSA 2020: 25–30 mg/kg actual body weight, max 3,000 mg.
      </p>

      {/* Suggested range */}
      <div className="flex items-baseline gap-2 mb-3">
        <span style={{ fontSize: 10, color: "var(--color-secondary)", ...FONT }}>Suggested range:</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--color-primary)", ...FONT }}>{loadLow}–{loadHigh} mg</span>
        <span style={{ fontSize: 9, color: "var(--color-dim)", ...FONT }}>(25–30 mg/kg × {wt} kg)</span>
      </div>

      {/* Editable dose */}
      <div className="mb-3">
        <label htmlFor="vz-loading-dose" style={{ fontSize: 9, fontWeight: 600, color: "var(--color-secondary)", display: "block", marginBottom: 3, ...FONT }}>
          LOADING DOSE (mg)
        </label>
        <select
          id="vz-loading-dose"
          value={customDose}
          onChange={e => setCustomDose(Number(e.target.value))}
          style={{
            width: "100%", padding: "8px 10px", fontSize: 16, fontWeight: 700,
            border: "1px solid var(--color-border)", background: "var(--color-card)",
            color: "var(--color-primary)", ...FONT,
          }}
        >
          {[1000, 1250, 1500, 1750, 2000, 2250, 2500, 2750, 3000].map(d => (
            <option key={d} value={d}>
              {d} mg {d === defaultDose ? "(suggested)" : ""}
            </option>
          ))}
        </select>
      </div>

      {/* Auto-calculated infusion */}
      <div className="flex items-center gap-3 mb-3" style={{ fontSize: 10, color: "var(--color-dim)", ...FONT }}>
        <span>Infusion: <strong style={{ color: "var(--color-secondary)" }}>{infusionHours}h</strong> ({infusionMinutes} min)</span>
        <span>Rate: <strong style={{ color: rateExceeded ? "#dc2626" : "var(--color-secondary)" }}>{(customDose / (infusionMinutes / 60)).toFixed(0)} mg/h</strong></span>
        {rateExceeded && <span style={{ color: "#dc2626", fontWeight: 700 }}>⚠ Exceeds 10 mg/min</span>}
      </div>

      {/* Simulate button */}
      {onSimulate && (
        <button
          type="button"
          onClick={() => onSimulate(customDose, 12, infusionHours)}
          className="w-full py-2.5 text-xs font-bold uppercase tracking-wider transition-colors"
          style={{
            background: "var(--color-primary)", color: "var(--color-card)",
            border: "none", cursor: "pointer", letterSpacing: "0.1em",
          }}
        >
          SIMULATE {customDose} mg LOADING DOSE PK →
        </button>
      )}

      {/* Guidance */}
      <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px solid var(--color-border)" }}>
        <p style={{ fontSize: 9, color: "var(--color-dim)", lineHeight: 1.7, margin: 0, ...FONT }}>
          After loading dose: draw first level 1.5–6h post-infusion end for early Bayesian estimation,
          or peak + trough near dose 3–4 for highest accuracy.
          Target AUC₂₄ 400–600 mg·h/L within 48h per ASHP/IDSA 2020.
        </p>
      </div>
    </div>
  );
}

/** Inline (card layout) wrapper: a full-width expander above the configurator. */
function LoadingDoseGuidance({ weightKg, onSimulate }: LoadingDoseConfiguratorProps) {
  const [expanded, setExpanded] = React.useState(false);
  return (
    <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: 8 }}>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        className="flex items-center gap-1.5 w-full text-left"
        style={{
          background: "#dbeafe",
          border: "1px solid #bfdbfe",
          cursor: "pointer",
          padding: "5px 10px",
          transition: "background 0.15s, border-color 0.15s",
          ...FONT,
        }}
      >
        <svg
          width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          style={{ color: "var(--color-dim)", transition: "transform 0.2s", transform: expanded ? "rotate(90deg)" : "rotate(0deg)" }}
        >
          <path d="M9 5l7 7-7 7" />
        </svg>
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--color-secondary)", letterSpacing: "0.08em", ...FONT }}>
          LOADING DOSE CONFIGURATOR
        </span>
      </button>
      {expanded && <div style={{ marginTop: 8 }}><LoadingDoseConfigurator weightKg={weightKg} onSimulate={onSimulate} /></div>}
    </div>
  );
}

/**
 * Popover variant for the recommendation band header. Closes on Escape and
 * on outside click; the trigger carries aria-expanded/aria-controls.
 */
export function LoadingDosePopover({ weightKg, onSimulate }: LoadingDoseConfiguratorProps) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("mousedown", onClick); };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="vz-loading-dose-popover"
        className="border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
        style={{ borderColor: "#bfdbfe", background: open ? "#bfdbfe" : "#dbeafe", color: "#1e3a5f", cursor: "pointer", ...FONT }}
      >
        Loading dose {open ? "▴" : "▾"}
      </button>
      {open && (
        <div
          id="vz-loading-dose-popover"
          role="dialog"
          aria-label="Loading dose configurator"
          className="absolute right-0 z-30 mt-1 w-[min(360px,90vw)] shadow-md"
        >
          <LoadingDoseConfigurator weightKg={weightKg} onSimulate={(d, i, h) => { setOpen(false); onSimulate?.(d, i, h); }} />
        </div>
      )}
    </div>
  );
}

export function aucRangeLabel(auc: number): { label: string; color: string; badgeStyle: React.CSSProperties } {
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
  predicted_auc24,
  isPulseDose,
  loadingDoseMg,
  onUndoLoadingDose,
  empiricDosingBlocked,
  adjustmentDosingBlocked,
  activeOption,
  activeIsCurrent = false,
  showOptionTabs = true,
  layout = "card",
  metricsSlot,
  showLoadingDose = true,
}: DoseRecommendationCardProps) {
  // Show options that are in-range or below-target only — never show above-target options
  const options = frequency_options?.filter(
    (o) => o.dose_mg >= 500 && o.auc24 <= 600
  ) ?? [];

  // All hooks must be called unconditionally on every render (Rules of Hooks).
  // The empiricDosingBlocked / no-recommendation early returns happen AFTER
  // hook setup so they don't change hook call ordering across renders.
  const [activeIdx, setActiveIdx] = useState<number>(() => {
    if (!recommended_dose || !recommended_interval_hours) return 0;
    const recDose = Number.parseFloat(recommended_dose);
    const idx = options.findIndex(
      (o) => o.dose_mg === recDose && o.interval_hours === recommended_interval_hours
    );
    return idx >= 0 ? idx : 0;
  });

  // SAFETY-CRITICAL: if the engine refused dosing for safety reasons,
  // render the safety state and DO NOT fall through to the standard
  // regimen card. Two refusal modes:
  //   - empiric_dosing_blocked: no safe fixed-interval regimen exists
  //     for the patient (severe AKI, etc.) → pulse-then-level workflow
  //   - adjustment_dosing_blocked: existing patient on too-aggressive
  //     regimen, no safe adjustment exists → hold + recheck level
  if (empiricDosingBlocked) {
    return <EmpiricDosingBlockedCard data={empiricDosingBlocked} />;
  }
  if (adjustmentDosingBlocked) {
    return <AdjustmentDosingBlockedCard data={adjustmentDosingBlocked} />;
  }

  if (!recommended_dose || !recommended_interval_hours) return null;

  // Controlled selection wins; otherwise the card's own tab state.
  const active = activeOption !== undefined ? activeOption : (options[activeIdx] ?? null);
  const isBand = layout === "band";
  const displayDose = active ? String(active.dose_mg) : recommended_dose;
  const displayInterval = active ? active.interval_hours : recommended_interval_hours;
  const displayInfusionHours = active?.infusion_duration_hours ?? recommended_infusion_duration_hours ?? 1;
  // Show AUC from active option, or fall back to the raw auc24 from the response
  const displayAUC = active?.auc24 ?? rawAuc24 ?? null;
  // The loading dose as entered is one dose, not a regimen: show it as "× 1"
  // and do not grade its first-24 h AUC against the steady-state target.
  const isSingleLoadingDose = Boolean(activeIsCurrent && isPulseDose);
  const range = displayAUC != null && !isSingleLoadingDose ? aucRangeLabel(displayAUC) : null;

  const subline = `Infuse over ${displayInfusionHours} hour${displayInfusionHours === 1 ? "" : "s"}.`;

  return (
    <div className={isBand ? "flex flex-col gap-2" : "flex flex-col gap-3"}>
      {/* Frequency tabs — horizontal scrollable */}
      {showOptionTabs && options.length > 1 && (
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
                    ? { background: "#fff", borderColor: "var(--color-primary)", color: "var(--color-primary)", fontFamily: "'Share Tech Mono', monospace" }
                    : { background: "#fff", borderColor: "var(--color-border)", color: "var(--color-primary)", fontFamily: "'Share Tech Mono', monospace" }
                }
                onMouseEnter={e => {
                  if (isActive) return;
                  (e.currentTarget as HTMLElement).style.background = "#dbeafe";
                  (e.currentTarget as HTMLElement).style.borderColor = "#93c5fd";
                }}
                onMouseLeave={e => {
                  if (isActive) return;
                  (e.currentTarget as HTMLElement).style.background = "#fff";
                  (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border)";
                }}
              >
                <span className="font-bold tabular-nums text-sm" style={{ color: "var(--color-primary)", fontFamily: "'Share Tech Mono', monospace" }}>
                  {opt.dose_mg} mg
                </span>
                <span className="font-medium" style={isActive ? { color: "var(--color-primary)", fontFamily: "'Share Tech Mono', monospace" } : { color: "var(--color-dim)", fontFamily: "'Share Tech Mono', monospace" }}>
                  q{opt.interval_hours}h
                </span>
                <span
                  className="mt-1 inline-flex border px-1.5 py-0.5 text-[10px] font-semibold leading-none"
                  style={{ ...r.badgeStyle }}
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
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "#047857", ...FONT }}>
              LOADING DOSE: {loadingDoseMg} mg (single dose)
            </span>
            {onUndoLoadingDose && (
              <button
                type="button"
                onClick={onUndoLoadingDose}
                className="shrink-0 border px-2 py-0.5 text-[10px] font-semibold transition-colors"
                style={{ borderColor: "#fca5a5", background: "#fff1f2", color: "#991b1b", ...FONT }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.background = "#991b1b";
                  (e.currentTarget as HTMLElement).style.color = "#fff";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.background = "#fff1f2";
                  (e.currentTarget as HTMLElement).style.color = "#991b1b";
                }}
              >
                UNDO
              </button>
            )}
          </div>
          <p className="mt-1 text-[10px]" style={{ color: "#065f46", margin: 0, ...FONT }}>
            Graph shows the loading dose followed by the selected maintenance regimen. Suggested maintenance to follow:
          </p>
        </div>
      )}

      {/* Active dose display */}
      <div className={isBand ? "flex flex-wrap items-stretch gap-2" : "flex items-start justify-between gap-2"}>
        <div className={isBand ? "flex-1 min-w-[260px]" : "flex-1"}>
          <div
            className={isBand ? "px-3 py-2 h-full" : "px-4 py-3"}
            style={{
              background: "var(--color-bg)",
              border: "1px solid var(--color-primary-a40)",
              boxShadow: isBand ? "none" : "0 0 16px var(--color-primary-a06)",
            }}
          >
            <p className="vz-kicker" style={{ margin: "0 0 2px 0", ...FONT }}>
              {activeIsCurrent
                ? (isPulseDose ? "LOADING DOSE (SINGLE DOSE)" : "CURRENT REGIMEN (AS ENTERED)")
                : isPulseDose
                  ? (active?.is_recommended || !active ? "SUGGESTED MAINTENANCE REGIMEN" : "SELECTED MAINTENANCE ALTERNATIVE")
                  : active?.is_recommended || !active ? "RECOMMENDED REGIMEN" : "SELECTED ALTERNATIVE"}
            </p>
            <div className="flex flex-wrap items-baseline gap-x-1.5">
              <span
                className={`${isBand ? "text-[34px] leading-none" : "text-4xl"} font-extrabold tabular-nums mx-glow`}
                style={{ color: "var(--color-primary)", fontFamily: "'Share Tech Mono', monospace", textShadow: "0 0 12px var(--color-glow-strong)" }}
              >
                {displayDose}
              </span>
              <span className="text-lg font-semibold" style={{ color: "var(--color-secondary)", fontFamily: "'Share Tech Mono', monospace" }}>mg</span>
              {isSingleLoadingDose ? (
                <span className="text-lg font-semibold mx-1" style={{ color: "var(--color-secondary)", fontFamily: "'Share Tech Mono', monospace" }}>× 1</span>
              ) : (
                <>
                  <span className="text-sm font-medium mx-1" style={{ color: "var(--color-dim)", fontFamily: "'Share Tech Mono', monospace" }}>every</span>
                  <span
                    className={`${isBand ? "text-[34px] leading-none" : "text-4xl"} font-extrabold tabular-nums mx-glow`}
                    style={{ color: "var(--color-primary)", fontFamily: "'Share Tech Mono', monospace", textShadow: "0 0 12px var(--color-glow-strong)" }}
                  >
                    {displayInterval}
                  </span>
                  <span className="text-lg font-semibold" style={{ color: "var(--color-secondary)", fontFamily: "'Share Tech Mono', monospace" }}>h</span>
                </>
              )}
              <span className="ml-2 text-xs" style={{ color: "var(--color-dim)", fontFamily: "'Share Tech Mono', monospace" }}>{subline}</span>
            </div>
            {!isBand && displayAUC != null && range && (
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
        {isBand && metricsSlot}
        {draftDiffersFromCalculated && onApplyRecommendation && (
          <div className="flex flex-col gap-2 shrink-0">
            <button
              type="button"
              onClick={onApplyRecommendation}
              className="px-3 py-1.5 text-xs font-semibold transition"
              style={{ border: "1px solid var(--color-primary-a40)", background: "var(--color-primary-a05)", color: "var(--color-secondary)", fontFamily: "'Share Tech Mono', monospace" }}
            >
              APPLY RECOMMENDED
            </button>
          </div>
        )}
      </div>

      {/* ARC Advisory — critical patient safety warning */}
      {arc_advisory?.detected && (
        <div className="rounded-lg border-2 px-4 py-3" style={{ borderColor: "#dc2626", background: "#fef2f2" }}>
          <p className="text-sm font-bold" style={{ color: "#991b1b", margin: 0 }}>
            ⚠ POSSIBLE AUGMENTED RENAL CLEARANCE
          </p>
          <div className="mt-2 space-y-1.5 text-xs" style={{ color: "#7f1d1d" }}>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {arc_advisory.crcl_indexed_ml_min_1_73 != null ? (
                <span><strong>Estimated CrCl:</strong> {arc_advisory.crcl_indexed_ml_min_1_73} mL/min/1.73 m² (threshold 130)</span>
              ) : (
                <span><strong>Estimated CrCl:</strong> {arc_advisory.crcl_ml_min} mL/min absolute — height not entered, so it could not be indexed</span>
              )}
              <span><strong>CL:</strong> {arc_advisory.cl_l_h} L/h</span>
              <span><strong>Required TDD:</strong> ~{arc_advisory.required_tdd_mg?.toLocaleString()} mg/day</span>
            </div>
            <p style={{ margin: 0, lineHeight: 1.6 }}>
              Estimating equations detect augmented renal clearance poorly. Confirm with a measured 8–24 hour
              urinary creatinine clearance before acting on this.
              {auc_range_status === "below_target"
                ? " The best available intermittent regimen for this patient is already below the 400–600 mg·h/L target."
                : ""}
            </p>
            <div style={{ margin: 0, lineHeight: 1.6 }}>
              <strong>If confirmed:</strong>
              <ul style={{ margin: "4px 0 0 16px", padding: 0, listStyleType: "disc" }}>
                <li>Obtain two vancomycin levels early (2–4h and 6–8h post-dose) to confirm individual PK parameters before proceeding</li>
                <li>Consult Infectious Diseases and/or nephrology. Continuous infusion is outside this calculator&rsquo;s scope — it is not modelled or dosed here, so manage it per local protocol rather than from these numbers</li>
              </ul>
            </div>
            <p style={{ margin: 0, fontSize: 10, fontStyle: "italic" }}>
              Threshold and definition: Udy 2013 (Crit Care 17:R35); Barletta 2017 (J Trauma Acute Care Surg
              82:665–71); Cucci 2023 (Pharmacotherapy 43:1131–8). The 2020 ASHP/IDSA/SIDP vancomycin guideline
              does not define an adult ARC threshold.
            </p>
          </div>
        </div>
      )}

      {/* Below-target warning (non-ARC) */}
      {!arc_advisory?.detected && auc_range_status === "below_target" && (predicted_auc24 ?? rawAuc24) != null && (
        <div className="rounded-lg border px-4 py-3" style={{ borderColor: "#fca5a5", background: "#fff1f2" }}>
          <p className="text-sm font-bold" style={{ color: "#991b1b", margin: 0 }}>
            AUC₂₄ BELOW TARGET
          </p>
          <p className="mt-1 text-xs" style={{ color: "#7f1d1d", margin: 0 }}>
            The recommended regimen is predicted to achieve AUC₂₄ of {predicted_auc24 ?? rawAuc24} mg·h/L, which is below the target range of 400–600 mg·h/L. Clinical review is required — consider more frequent dosing, higher doses, or continuous infusion.
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
      {showLoadingDose && active && (
        <LoadingDoseGuidance weightKg={patientWeightKg ?? null} onSimulate={onSimulateLoadingDose} />
      )}

      {!isBand && calculationDetails?.review_status?.banner_body && (
        <div className="text-xs leading-5 pt-2" style={{ color: "var(--color-dim)", borderTop: "1px solid var(--color-border)", fontFamily: "'Share Tech Mono', monospace" }}>
          <p style={{ margin: 0 }}>{calculationDetails.review_status.banner_body}</p>
          <p style={{ margin: "4px 0 0 0" }}>Draw first level 1.5–6h post-infusion end (dose 1 acceptable) or peak + trough near dose 3–4 for highest AUC accuracy — target AUC₂₄ 400–600 mg·h/L within 48h per ASHP/IDSA 2020.</p>
        </div>
      )}
    </div>
  );
}

/**
 * Pulse-dose safety state — shown when the engine refused empiric fixed-
 * interval dosing because no candidate in its search grid was safe (typically
 * severe renal impairment, CL < ~0.5 L/h). Replaces the standard dose card.
 */
function EmpiricDosingBlockedCard({
  data,
}: {
  data: NonNullable<DoseRecommendationCardProps["empiricDosingBlocked"]>;
}) {
  return (
    <div
      role="alert"
      className="border-l-4 p-4"
      style={{
        background: "#fff1f2",
        borderColor: "#dc2626",
        borderLeftColor: "#dc2626",
      }}
    >
      <div className="mb-2 flex items-baseline gap-2">
        <span className="text-base font-bold uppercase tracking-wider" style={{ color: "#991b1b" }}>
          ⚠ Empiric dosing refused
        </span>
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#991b1b" }}>
          Pulse-then-level required
        </span>
      </div>
      <p className="mb-3 text-[13px] leading-relaxed" style={{ color: "#7f1d1d" }}>
        {data.safety_message}
      </p>
      <div
        className="mb-3 grid gap-2 border p-3 text-[13px]"
        style={{ background: "#ffffff", borderColor: "#fca5a5", color: "#7f1d1d" }}
      >
        <div className="font-bold uppercase tracking-wider text-xs">Recommended pulse dose</div>
        <div className="text-xl font-bold" style={FONT}>
          {data.recommended_pulse_dose_mg.toLocaleString()} mg <span className="text-sm font-normal">× 1 (single dose)</span>
        </div>
        <div className="text-xs">
          Estimated CL: <strong>{data.estimated_cl_l_h.toFixed(2)} L/h</strong>. Draw a vancomycin level
          after the pulse dose and switch to the <strong>1-Level</strong> tab above to compute
          level-guided redose timing.
        </div>
      </div>
      <p className="text-[11px]" style={{ color: "#7f1d1d" }}>
        This is decision-support output only. The pulse-dose value is a weight-based estimate
        (15–20 mg/kg, capped at 3000 mg); confirm against institutional protocol and
        patient-specific factors before administration.
      </p>
    </div>
  );
}

/**
 * Hold-and-recheck safety state — shown when the adjustment engine
 * cannot find any regimen in its search space whose predicted peak/
 * trough stay within institutional caps. Typically severe renal
 * impairment + sparse data where the patient's current regimen is
 * already supra-therapeutic and no acceptable dose-down or interval-
 * extension exists in the search grid.
 */
function AdjustmentDosingBlockedCard({
  data,
}: {
  data: NonNullable<DoseRecommendationCardProps["adjustmentDosingBlocked"]>;
}) {
  return (
    <div
      role="alert"
      className="border-l-4 p-4"
      style={{
        background: "#fff1f2",
        borderColor: "#dc2626",
        borderLeftColor: "#dc2626",
      }}
    >
      <div className="mb-2 flex items-baseline gap-2">
        <span className="text-base font-bold uppercase tracking-wider" style={{ color: "#991b1b" }}>
          ⚠ No safe adjustment exists
        </span>
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#991b1b" }}>
          Hold &amp; recheck
        </span>
      </div>
      <p className="mb-3 text-[13px] leading-relaxed" style={{ color: "#7f1d1d" }}>
        {data.safety_message}
      </p>
      <div
        className="mb-3 grid gap-2 border p-3 text-[13px]"
        style={{ background: "#ffffff", borderColor: "#fca5a5", color: "#7f1d1d" }}
      >
        <div className="font-bold uppercase tracking-wider text-xs">Recommended action</div>
        <div className="text-[13px] font-semibold" style={FONT}>
          {data.recommended_action}
        </div>
        <div className="text-xs">
          Estimated CL: <strong>{data.estimated_cl_l_h.toFixed(2)} L/h</strong>.
        </div>
      </div>
      <p className="text-[11px]" style={{ color: "#7f1d1d" }}>
        This is decision-support output only. Holding maintenance dosing is the
        engine&apos;s safety position when no acceptable dose-down or interval-extension
        exists in its search grid; clinical context (infection severity, hemodynamics,
        institutional protocol) remains the clinician&apos;s judgment.
      </p>
    </div>
  );
}
