"use client";

import { useState, useEffect } from "react";
import {
  COLIN_2019,
  COLIN_2019_PARAMETERS,
  VANCOMYZER_CUSTOM_OBESITY_MODEL_RETIRED,
  modelShortName,
} from "@/lib/pk/modelRegistry";
import { fmt } from "@/lib/formatNumber";

interface PKParams {
  CL: number;
  V1: number;
  Q: number;
  V2: number;
  used_posterior_refinement: boolean;
  scr: number;
  age?: number;
  weight_kg?: number;
  /** "vancomyzer_obesity" can only come from a result calculated before 15 Sep 2026. */
  pk_model_name?: "colin_2019" | "vancomyzer_obesity";
  /** Returned only by the retired obesity model; not displayed. */
  ffm_kg?: number;
}

interface PKParametersMathProps {
  params: PKParams;
}

const STORAGE_KEY = "vancomyzer_show_math";

type ParamKey = keyof Pick<PKParams, "CL" | "V1" | "Q" | "V2">;

interface ParamRow {
  key: ParamKey;
  label: string;
  unit: string;
  /** Equation text from the model registry. */
  equation: string;
  substitute: (p: PKParams) => string;
  /** Population-prior value from the substituted arithmetic. */
  prior: (p: PKParams) => number;
}

const P = COLIN_2019_PARAMETERS;

/**
 * Floors applied by the engine before the Colin 2019 equations
 * (src/lib/pk/posterior/buildPriorParameters.ts). Mirrored so the substituted
 * arithmetic reproduces the population-prior values the engine computed.
 */
const MIN_ADULT_AGE_YEARS = 18;
const MIN_SCR_MG_DL = 0.4;

interface ColinCovariates {
  PMA_yr: number;
  FMat: number;
  FDecline: number;
  SCRstd: number;
  FSCR: number;
  scr: number;
}

function colinCovariates(age: number, scrInput: number): ColinCovariates {
  const PMA_yr = Math.max(MIN_ADULT_AGE_YEARS, age) + 40 / 52;
  const PMA_wk = PMA_yr * 52;
  const FMat = PMA_wk ** P.hillMaturation / (PMA_wk ** P.hillMaturation + P.pma50Weeks ** P.hillMaturation);
  const FDecline = 1 / (1 + (PMA_yr / P.age50DeclineYears) ** P.hillDecline);
  const SCRstd = Math.exp(-1.228 + Math.log10(PMA_yr) * 0.672 + 6.27 * Math.exp(-3.11 * PMA_yr));
  const scr = Math.max(MIN_SCR_MG_DL, scrInput);
  const FSCR = Math.exp(-P.thetaSCr * (scr - SCRstd));
  return { PMA_yr, FMat, FDecline, SCRstd, FSCR, scr };
}

const f3 = (n: number): string => fmt(n, 3);
const weightOf = (p: PKParams): number => p.weight_kg ?? 70;
const allometric = (p: PKParams): number => (weightOf(p) / 70) ** 0.75;

function buildColinRows(): ParamRow[] {
  return [
    {
      key: "CL",
      label: "CL",
      unit: "L/h",
      equation: COLIN_2019.equations.CL,
      substitute: (p) => {
        const c = colinCovariates(p.age ?? MIN_ADULT_AGE_YEARS, p.scr);
        return `${P.thetaCL} × (${weightOf(p)}/70)^0.75 × ${f3(c.FMat)} × ${f3(c.FDecline)} × ${f3(c.FSCR)}`;
      },
      prior: (p) => {
        const c = colinCovariates(p.age ?? MIN_ADULT_AGE_YEARS, p.scr);
        return P.thetaCL * allometric(p) * c.FMat * c.FDecline * c.FSCR;
      },
    },
    {
      key: "V1",
      label: "V1",
      unit: "L",
      equation: COLIN_2019.equations.V1,
      substitute: (p) => `${P.thetaV1} × (${weightOf(p)}/70)`,
      prior: (p) => P.thetaV1 * (weightOf(p) / 70),
    },
    {
      key: "Q",
      label: "Q",
      unit: "L/h",
      equation: COLIN_2019.equations.Q,
      substitute: (p) => `${P.thetaQ} × (${weightOf(p)}/70)^0.75`,
      prior: (p) => P.thetaQ * allometric(p),
    },
    {
      key: "V2",
      label: "V2",
      unit: "L",
      equation: COLIN_2019.equations.V2,
      substitute: (p) => `${P.thetaV2} × (${weightOf(p)}/70)`,
      prior: (p) => P.thetaV2 * (weightOf(p) / 70),
    },
  ];
}

const PARAM_LABELS: { key: ParamKey; label: string; unit: string }[] = [
  { key: "CL", label: "CL", unit: "L/h" },
  { key: "V1", label: "V1", unit: "L" },
  { key: "Q", label: "Q", unit: "L/h" },
  { key: "V2", label: "V2", unit: "L" },
];

const RETIRED = VANCOMYZER_CUSTOM_OBESITY_MODEL_RETIRED;

export default function PKParametersMath({ params }: PKParametersMathProps) {
  // Collapsed by default. Expanded, the derivation runs ~350px and pushed the
  // concentration-time graph below the fold, so the clinician had to scroll to
  // see the curve. Nothing is hidden: the Show Math toggle sits directly above.
  const [showMath, setShowMath] = useState(false);

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

  // A stored result from the retired custom obesity model cannot be reproduced
  // with the Colin 2019 equations, so its values are shown without arithmetic.
  const isRetiredModel = params.pk_model_name === RETIRED.id;
  const PARAM_ROWS = buildColinRows();
  const covariates = colinCovariates(params.age ?? MIN_ADULT_AGE_YEARS, params.scr);
  const modelHeaderLabel = modelShortName(params.pk_model_name);
  const monoDim = { fontSize: 10, color: "var(--color-dim)", fontFamily: "var(--font-mono, monospace)", lineHeight: 1.4 } as const;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: "var(--color-primary)", margin: 0 }}>
          PK Parameters <span style={{ color: isRetiredModel ? "#92400e" : "var(--color-dim)", fontWeight: 500 }}>({modelHeaderLabel})</span>
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

      {/* Historical result from the retired model */}
      {isRetiredModel && (
        <div className="mb-1" style={{ fontSize: 10, color: "#92400e", background: "#fffbeb", border: "1px solid #fcd34d", padding: "4px 6px", lineHeight: 1.5 }}>
          <strong>Historical calculation.</strong> These stored values belong to an earlier software version.
          Recalculate with the current version before reviewing a dosing decision.
        </div>
      )}

      {/* Compact parameter grid — 2x2 when math hidden (always for retired-model results), stacked when shown */}
      {!showMath || isRetiredModel ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
          {PARAM_LABELS.map((row) => {
            const value = params[row.key];
            return (
              <div key={row.key} className="flex items-baseline justify-between" style={{ padding: "3px 6px", background: "var(--color-highlight, rgba(0,0,0,0.03))", border: "1px solid var(--color-border)" }}>
                <span style={{ fontSize: 11, color: "var(--color-secondary)", fontWeight: 600, fontFamily: "var(--font-mono, monospace)" }}>{row.label}</span>
                <span style={{ fontSize: 13, color: "var(--color-primary)", fontWeight: 700, fontFamily: "var(--font-mono, monospace)" }}>
                  {typeof value === "number" ? fmt(value, 1) : "—"}{" "}
                  <span style={{ fontSize: 9, color: "var(--color-dim)", fontWeight: 400 }}>{row.unit}</span>
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {PARAM_ROWS.map((row, i) => {
            const value = params[row.key];
            const prior = row.prior(params);
            return (
              <div key={row.key} style={{ borderTop: i === 0 ? "none" : "1px solid var(--color-border)", padding: "4px 0" }}>
                <div className="flex items-baseline justify-between">
                  <span style={{ fontSize: 12, color: "var(--color-secondary)", fontWeight: 600, fontFamily: "var(--font-mono, monospace)" }}>{row.label}</span>
                  <span style={{ fontSize: 14, color: "var(--color-primary)", fontWeight: 700, fontFamily: "var(--font-mono, monospace)" }}>
                    {typeof value === "number" ? fmt(value, 1) : "—"}{" "}
                    <span style={{ fontSize: 10, color: "var(--color-secondary)", fontWeight: 400 }}>{row.unit}</span>
                  </span>
                </div>
                <div style={{ ...monoDim, marginTop: 2, overflow: "auto" }}>
                  <div>{row.equation}</div>
                  {row.key === "CL" && (
                    <div style={{ paddingLeft: 8 }}>
                      <div>{COLIN_2019.equations.PMA} = {fmt(covariates.PMA_yr, 2)}</div>
                      <div>{COLIN_2019.equations.FMat} = {f3(covariates.FMat)}</div>
                      <div>{COLIN_2019.equations.FDecline} = {f3(covariates.FDecline)}</div>
                      <div>{COLIN_2019.equations.SCRstd} = {f3(covariates.SCRstd)}</div>
                      <div>
                        {COLIN_2019.equations.FSCR} = {f3(covariates.FSCR)}
                        {` (SCr values below ${MIN_SCR_MG_DL} mg/dL are raised to ${MIN_SCR_MG_DL} mg/dL before use)`}
                      </div>
                    </div>
                  )}
                  <div>
                    <span style={{ color: "var(--color-secondary)" }}>{row.substitute(params)}</span>
                    {params.used_posterior_refinement ? (
                      <span style={{ color: "var(--color-secondary)" }}> = {fmt(prior, 1)} {row.unit} (population prior)</span>
                    ) : (
                      <span style={{ color: "var(--color-primary)", fontWeight: 600 }}> = {typeof value === "number" ? fmt(value, 1) : "?"} {row.unit}</span>
                    )}
                  </div>
                  {params.used_posterior_refinement && (
                    <div>
                      <span style={{ color: "var(--color-primary)", fontWeight: 600 }}>
                        Bayesian estimate from measured levels: {typeof value === "number" ? fmt(value, 1) : "?"} {row.unit}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Bayesian note */}
      {showMath && params.used_posterior_refinement && !isRetiredModel && (
        <p style={{ fontSize: 9, color: "var(--color-dim)", fontStyle: "italic", marginTop: 4, margin: 0 }}>
          {"↳"} Population-prior arithmetic shown; displayed values are the Bayesian estimates updated from measured levels
        </p>
      )}

      {/* Citation */}
      {!isRetiredModel && (
        <div style={{ marginTop: 6, paddingTop: 4, borderTop: "1px solid var(--color-border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 2 }}>
          <span style={{ fontSize: 9, color: "var(--color-dim)" }}>{COLIN_2019.citation}</span>
          <a
            href={`https://doi.org/${COLIN_2019.doi}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 9, color: "var(--color-primary)", textDecoration: "none", fontWeight: 500 }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.textDecoration = "underline"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.textDecoration = "none"; }}
          >
            DOI {"↗"}
          </a>
        </div>
      )}
    </div>
  );
}
