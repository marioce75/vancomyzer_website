"use client";

import { useState, useEffect } from "react";

interface PKParams {
  CL: number;
  V1: number;
  Q: number;
  V2: number;
  used_posterior_refinement: boolean;
  scr: number;
  age?: number;
  weight_kg?: number;
  pk_model_name?: "colin_2019" | "vancomyzer_obesity";
  ffm_kg?: number;
}

interface PKParametersMathProps {
  params: PKParams;
}

const STORAGE_KEY = "vancomyzer_show_math";

interface ParamRow {
  key: keyof Pick<PKParams, "CL" | "V1" | "Q" | "V2">;
  label: string;
  unit: string;
  equation: string;
  substitute: (p: PKParams) => string;
}

/**
 * Colin 2019 Table 3 estimates and covariate factors.
 *
 * These MIRROR src/lib/pk/posterior/buildPriorParameters.ts, which is the
 * engine's source of truth. The equations and the substituted values shown to
 * the clinician must reproduce the number the engine actually computed \u2014 if
 * this block and the engine ever diverge, the panel is lying about the math.
 */
const COLIN = {
  THETA_CL: 5.31,
  THETA_V1: 42.9,
  THETA_V2: 41.7,
  THETA_Q: 3.22,
  PMA50_WK: 46.4,
  GAMMA1: 2.89,
  AGE50_YR: 61.6,
  GAMMA2: 2.24,
  THETA_SCR: 0.649,
  MIN_SCR: 0.4,
} as const;

function colinFactors(age: number, scr: number): { FMat: number; FDecline: number; FSCR: number } {
  const PMA_yr = Math.max(18, age) + 40 / 52;
  const PMA_wk = PMA_yr * 52;
  const FMat = PMA_wk ** COLIN.GAMMA1 / (PMA_wk ** COLIN.GAMMA1 + COLIN.PMA50_WK ** COLIN.GAMMA1);
  const FDecline = 1 / (1 + (PMA_yr / COLIN.AGE50_YR) ** COLIN.GAMMA2);
  const SCRstd = Math.exp(-1.228 + Math.log10(PMA_yr) * 0.672 + 6.27 * Math.exp(-3.11 * PMA_yr));
  const FSCR = Math.exp(-COLIN.THETA_SCR * (Math.max(COLIN.MIN_SCR, scr) - SCRstd));
  return { FMat, FDecline, FSCR };
}

/**
 * The obesity model applies its age-decline factor to RAW age, not to the
 * post-menstrual age the Colin path uses (obesityModel.ts → obesityFDecline).
 * Using the Colin variant here leaves the printed arithmetic ~1.4% off the
 * engine's clearance, so the two must stay separate.
 */
function obesityFDecline(age: number): number {
  if (age <= 0) return 1.0;
  return 1 / (1 + (age / COLIN.AGE50_YR) ** COLIN.GAMMA2);
}

const f3 = (n: number): string => n.toFixed(3);

function buildColinRows(): ParamRow[] {
  return [
    {
      key: "CL",
      label: "CL",
      unit: "L/h",
      equation: "CL = 5.31 \u00d7 (WT / 70)^0.75 \u00d7 FMat \u00d7 FDecline \u00d7 FSCR",
      substitute: (p) => {
        const wt = p.weight_kg ?? 70;
        const { FMat, FDecline, FSCR } = colinFactors(p.age ?? 18, p.scr);
        return `5.31 \u00d7 (${wt} / 70)\u2070\u00b7\u2077\u2075 \u00d7 ${f3(FMat)} \u00d7 ${f3(FDecline)} \u00d7 ${f3(FSCR)}`;
      },
    },
    {
      key: "V1",
      label: "V1",
      unit: "L",
      equation: "V1 = 42.9 \u00d7 (WT / 70)",
      substitute: (p) => `42.9 \u00d7 (${p.weight_kg ?? 70} / 70)`,
    },
    {
      key: "Q",
      label: "Q",
      unit: "L/h",
      equation: "Q = 3.22 \u00d7 (WT / 70)^0.75",
      substitute: (p) => `3.22 \u00d7 (${p.weight_kg ?? 70} / 70)\u2070\u00b7\u2077\u2075`,
    },
    {
      key: "V2",
      label: "V2",
      unit: "L",
      equation: "V2 = 41.7 \u00d7 (WT / 70)",
      substitute: (p) => `41.7 \u00d7 (${p.weight_kg ?? 70} / 70)`,
    },
  ];
}

function buildObesityRows(): ParamRow[] {
  return [
    {
      key: "CL",
      label: "CL",
      unit: "L/h",
      // FDecline is applied by the engine (buildObesityPriors) and must be shown,
      // otherwise the printed arithmetic cannot reproduce the CL beside it.
      equation: "CL = (0.0571 \u00d7 CrCl + 0.0158 \u00d7 TBW) \u00d7 FDecline(age)",
      substitute: (p) => {
        const wt = p.weight_kg ?? "?";
        return `(0.0571 \u00d7 CrCl + 0.0158 \u00d7 ${wt}) \u00d7 ${f3(obesityFDecline(p.age ?? 18))}`;
      },
    },
    {
      key: "V1",
      label: "V1",
      unit: "L",
      equation: "V1 = 0.287 \u00d7 FFM",
      substitute: (p) => {
        const ffm = p.ffm_kg ? p.ffm_kg.toFixed(1) : "?";
        return `0.287 \u00d7 ${ffm}`;
      },
    },
    {
      key: "Q",
      label: "Q",
      unit: "L/h",
      equation: "Q = 1.23 L/h (fixed)",
      substitute: () => "1.23 (fixed intercompartmental CL)",
    },
    {
      key: "V2",
      label: "V2",
      unit: "L",
      equation: "V2 = 0.89 \u00d7 FFM",
      substitute: (p) => {
        const ffm = p.ffm_kg ? p.ffm_kg.toFixed(1) : "?";
        return `0.89 \u00d7 ${ffm}`;
      },
    },
  ];
}

export default function PKParametersMath({ params }: PKParametersMathProps) {
  const [showMath, setShowMath] = useState(true);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) setShowMath(stored === "true");
    } catch { /* ignore */ }
  }, []);

  const toggleMath = () => {
    const next = !showMath;
    setShowMath(next);
    try { localStorage.setItem(STORAGE_KEY, String(next)); } catch { /* ignore */ }
  };

  const isObesity = params.pk_model_name === "vancomyzer_obesity";
  const PARAM_ROWS = isObesity ? buildObesityRows() : buildColinRows();

  const modelHeaderLabel = isObesity
    ? "Vancomyzer Obesity Model \u2014 derived from Smit 2020 + Zhang 2024"
    : "Colin 2019";

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: "var(--color-primary)", margin: 0 }}>
          PK Parameters <span style={{ color: isObesity ? "#92400e" : "var(--color-dim)", fontWeight: 500 }}>({modelHeaderLabel})</span>
        </p>
        <button
          type="button"
          onClick={toggleMath}
          style={{
            fontSize: 9,
            color: "var(--color-primary)",
            background: "transparent",
            border: "1px solid var(--color-border)",
            padding: "2px 8px",
            cursor: "pointer",
            fontWeight: 600,
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = "var(--color-primary)";
            (e.currentTarget as HTMLElement).style.color = "var(--color-card, #fff)";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = "transparent";
            (e.currentTarget as HTMLElement).style.color = "var(--color-primary)";
          }}
        >
          {showMath ? "Hide Math" : "Show Math"}
        </button>
      </div>

      {/* FFM display for obesity model */}
      {isObesity && params.ffm_kg && (
        <div className="mb-1" style={{ fontSize: 10, color: "#92400e", fontWeight: 600 }}>
          Fat-Free Mass: {params.ffm_kg.toFixed(1)} kg <span style={{ fontWeight: 400 }}>(Janmahasatian 2005)</span>
        </div>
      )}

      {/* Compact parameter grid — 2x2 when math hidden, stacked when shown */}
      {!showMath ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
          {PARAM_ROWS.map((row) => {
            const value = params[row.key];
            return (
              <div key={row.key} className="flex items-baseline justify-between" style={{ padding: "3px 6px", background: "var(--color-highlight, rgba(0,0,0,0.03))", border: "1px solid var(--color-border)" }}>
                <span style={{ fontSize: 11, color: "var(--color-secondary)", fontWeight: 600, fontFamily: "var(--font-mono, monospace)" }}>{row.label}</span>
                <span style={{ fontSize: 13, color: "var(--color-primary)", fontWeight: 700, fontFamily: "var(--font-mono, monospace)" }}>
                  {typeof value === "number" ? value.toFixed(1) : "\u2014"}{" "}
                  <span style={{ fontSize: 9, color: "var(--color-dim)", fontWeight: 400 }}>{row.unit}</span>
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {/* FFM equation display for obesity model */}
          {isObesity && showMath && (
            <div style={{ padding: "4px 0", borderBottom: "1px solid var(--color-border)" }}>
              <div style={{ fontSize: 10, color: "var(--color-dim)", fontFamily: "var(--font-mono, monospace)", lineHeight: 1.5 }}>
                <div>FFM (male) = (9270 \u00d7 TBW) / (6680 + 216 \u00d7 BMI)</div>
                <div>FFM (female) = (9270 \u00d7 TBW) / (8780 + 244 \u00d7 BMI)</div>
              </div>
            </div>
          )}
          {PARAM_ROWS.map((row, i) => {
            const value = params[row.key];
            return (
              <div key={row.key} style={{ borderTop: (i === 0 && !isObesity) ? "none" : "1px solid var(--color-border)", padding: "4px 0" }}>
                <div className="flex items-baseline justify-between">
                  <span style={{ fontSize: 12, color: "var(--color-secondary)", fontWeight: 600, fontFamily: "var(--font-mono, monospace)" }}>{row.label}</span>
                  <span style={{ fontSize: 14, color: "var(--color-primary)", fontWeight: 700, fontFamily: "var(--font-mono, monospace)" }}>
                    {typeof value === "number" ? value.toFixed(1) : "\u2014"}{" "}
                    <span style={{ fontSize: 10, color: "var(--color-secondary)", fontWeight: 400 }}>{row.unit}</span>
                  </span>
                </div>
                <div style={{ marginTop: 2, fontSize: 10, color: "var(--color-dim)", fontFamily: "var(--font-mono, monospace)", lineHeight: 1.4, overflow: "auto" }}>
                  <div>{row.equation}</div>
                  <div>
                    <span style={{ color: "var(--color-secondary)" }}>{row.substitute(params)}</span>
                    <span style={{ color: "var(--color-primary)", fontWeight: 600 }}> = {typeof value === "number" ? value.toFixed(1) : "?"} {row.unit}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Bayesian note */}
      {showMath && params.used_posterior_refinement && (
        <p style={{ fontSize: 9, color: "var(--color-dim)", fontStyle: "italic", marginTop: 4, margin: 0 }}>
          {"\u21B3"} Estimates updated via Bayesian posterior
        </p>
      )}

      {/* Citation */}
      <div style={{ marginTop: 6, paddingTop: 4, borderTop: "1px solid var(--color-border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 2 }}>
        {isObesity ? (
          <>
            <span style={{ fontSize: 9, color: "var(--color-dim)" }}>Smit C et al. <em>Br J Clin Pharmacol.</em> 2020 &middot; Zhang T et al. <em>Clin Pharmacokinet.</em> 2024</span>
            <span style={{ display: "flex", gap: 6 }}>
              <a href="https://doi.org/10.1111/bcp.14144" target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 9, color: "var(--color-primary)", textDecoration: "none", fontWeight: 500 }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.textDecoration = "underline"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.textDecoration = "none"; }}>
                Smit DOI {"\u2197"}
              </a>
              <a href="https://doi.org/10.1007/s40262-023-01324-5" target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 9, color: "var(--color-primary)", textDecoration: "none", fontWeight: 500 }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.textDecoration = "underline"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.textDecoration = "none"; }}>
                Zhang DOI {"\u2197"}
              </a>
            </span>
          </>
        ) : (
          <>
            <span style={{ fontSize: 9, color: "var(--color-dim)" }}>Colin PJ et al. <em>Clin Pharmacokinet.</em> 2019;58(6):767-780</span>
            <a
              href="https://doi.org/10.1007/s40262-018-0727-5"
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 9, color: "var(--color-primary)", textDecoration: "none", fontWeight: 500 }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.textDecoration = "underline"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.textDecoration = "none"; }}
            >
              DOI {"\u2197"}
            </a>
          </>
        )}
      </div>
    </div>
  );
}
