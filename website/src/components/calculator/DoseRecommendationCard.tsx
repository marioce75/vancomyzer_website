"use client";

import React, { useState } from "react";
import { CalculationDetails, FrequencyOption } from "@/types/calculator";

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
}

function aucRangeLabel(auc: number): { label: string; color: string } {
  if (auc >= 400 && auc <= 600) return { label: "In range", color: "text-emerald-700 bg-emerald-50 border-emerald-200" };
  if (auc > 600) return { label: "Above target", color: "text-amber-700 bg-amber-50 border-amber-200" };
  return { label: "Below target", color: "text-rose-700 bg-rose-50 border-rose-200" };
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
}: DoseRecommendationCardProps) {
  // Only display options with AUC24 strictly within 400–600 mg·h/L (ASHP/IDSA/SIDP 2020).
  // The backend already enforces this; this is a defensive client-side guard.
  const options = frequency_options?.filter(
    (o) => o.dose_mg >= 500 && o.auc24 >= 400 && o.auc24 <= 600
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
  const displayAUC = active?.auc24 ?? null;
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
                    ? { background: "#00ff41", borderColor: "#00ff41", color: "#000000", fontFamily: "'Share Tech Mono', monospace" }
                    : { background: "#000000", borderColor: "#003b00", color: "#00a827", fontFamily: "'Share Tech Mono', monospace" }
                }
              >
                <span className="font-bold tabular-nums text-sm" style={isActive ? { color: "#000000" } : { color: "#00ff41", fontFamily: "'Share Tech Mono', monospace" }}>
                  {opt.dose_mg} mg
                </span>
                <span className="font-medium" style={isActive ? { color: "#000000" } : { color: "#1a5c1a", fontFamily: "'Share Tech Mono', monospace" }}>
                  q{opt.interval_hours}h
                </span>
                <span
                  className="mt-1 inline-flex border px-1.5 py-0.5 text-[10px] font-semibold leading-none"
                  style={isActive
                    ? { borderColor: "rgba(0,0,0,0.3)", background: "rgba(0,0,0,0.15)", color: "#000000", fontFamily: "'Share Tech Mono', monospace" }
                    : { borderColor: "rgba(0,255,65,0.3)", background: "rgba(0,255,65,0.05)", color: "#00a827", fontFamily: "'Share Tech Mono', monospace" }
                  }
                >
                  {r.label}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Active dose display */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div
            className="px-4 py-3"
            style={{
              background: "#000000",
              border: "1px solid rgba(0,255,65,0.4)",
              boxShadow: "0 0 16px rgba(0,255,65,0.06)",
            }}
          >
            <div className="flex flex-wrap items-baseline gap-x-1.5">
              <span
                className="text-4xl font-extrabold tabular-nums mx-glow"
                style={{ color: "#00ff41", fontFamily: "'Share Tech Mono', monospace", textShadow: "0 0 12px rgba(0,255,65,0.8)" }}
              >
                {displayDose}
              </span>
              <span className="text-xl font-semibold" style={{ color: "#00a827", fontFamily: "'Share Tech Mono', monospace" }}>mg</span>
              <span className="text-base font-medium mx-1" style={{ color: "#1a5c1a", fontFamily: "'Share Tech Mono', monospace" }}>every</span>
              <span
                className="text-4xl font-extrabold tabular-nums mx-glow"
                style={{ color: "#00ff41", fontFamily: "'Share Tech Mono', monospace", textShadow: "0 0 12px rgba(0,255,65,0.8)" }}
              >
                {displayInterval}
              </span>
              <span className="text-xl font-semibold" style={{ color: "#00a827", fontFamily: "'Share Tech Mono', monospace" }}>h</span>
            </div>
            <p className="mt-1 text-xs" style={{ color: "#1a5c1a", fontFamily: "'Share Tech Mono', monospace" }}>{subline}</p>
            {displayAUC != null && range && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs" style={{ color: "#1a5c1a", fontFamily: "'Share Tech Mono', monospace" }}>AUC24</span>
                <span className="tabular-nums text-sm font-bold" style={{ color: "#00ff41", fontFamily: "'Share Tech Mono', monospace" }}>{displayAUC}</span>
                <span className="text-xs" style={{ color: "#1a5c1a", fontFamily: "'Share Tech Mono', monospace" }}>mg·h/L</span>
                <span className="inline-flex border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider" style={{ borderColor: "rgba(0,255,65,0.4)", background: "rgba(0,255,65,0.06)", color: "#00a827", fontFamily: "'Share Tech Mono', monospace" }}>
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
              style={{ border: "1px solid rgba(0,255,65,0.4)", background: "rgba(0,255,65,0.05)", color: "#00a827", fontFamily: "'Share Tech Mono', monospace" }}
            >
              [APPLY RECOMMENDED]
            </button>
          )}
        </div>
      </div>

      {infusion_safety_note && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
          <strong>Note:</strong> {infusion_safety_note}
        </div>
      )}

      {calculationDetails?.review_status?.banner_body && (
        <p className="text-xs leading-5 pt-2" style={{ color: "#1a5c1a", borderTop: "1px solid #003b00", fontFamily: "'Share Tech Mono', monospace" }}>
          {calculationDetails.review_status.banner_body}
        </p>
      )}
    </div>
  );
}
