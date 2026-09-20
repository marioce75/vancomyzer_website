"use client";

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

const PARAM_LABELS: { key: ParamKey; label: string; unit: string; description: string }[] = [
  { key: "CL", label: "Clearance", unit: "L/h", description: "Estimated ability to remove vancomycin from the body." },
  { key: "V1", label: "Central volume", unit: "L", description: "Model volume for blood and rapidly equilibrating tissues." },
  { key: "V2", label: "Peripheral volume", unit: "L", description: "Model volume for tissues that equilibrate more slowly." },
  { key: "Q", label: "Distribution clearance", unit: "L/h", description: "Estimated exchange between the two model compartments." },
];

const RETIRED = VANCOMYZER_CUSTOM_OBESITY_MODEL_RETIRED;

export default function PKParametersMath({ params }: PKParametersMathProps) {
  const isRetiredModel = params.pk_model_name === RETIRED.id;
  const rows = buildColinRows();
  const covariates = colinCovariates(params.age ?? MIN_ADULT_AGE_YEARS, params.scr);
  const modelHeaderLabel = modelShortName(params.pk_model_name);
  const equationStyle = { fontSize: 12, lineHeight: 1.6, overflowWrap: "anywhere" as const, color: "var(--color-secondary)" };

  return (
    <section aria-label="Pharmacokinetic estimates" style={{ minWidth: 0 }}>
      <h3 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 4px", color: "var(--color-primary)" }}>Pharmacokinetic estimates</h3>
      <p style={{ fontSize: 12, lineHeight: 1.5, margin: "0 0 12px", color: "var(--color-secondary)" }}>
        Model: {modelHeaderLabel}. {params.used_posterior_refinement ? "Estimates updated using measured vancomycin levels." : "Estimates based on patient information, without measured-level adjustment."}
      </p>
      {isRetiredModel && (
        <p style={{ fontSize: 13, padding: 8, color: "#92400e", background: "#fffbeb" }}>
          <strong>Saved historical calculation.</strong> Recalculate using the current calculator before reviewing a dosing decision.
        </p>
      )}
      <dl style={{ margin: 0 }}>
        {PARAM_LABELS.map(row => (
          <div key={row.key} style={{ borderTop: "1px solid var(--color-border)", padding: "10px 0" }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
              <dt style={{ fontSize: 13, fontWeight: 600, color: "var(--color-secondary)" }}>{row.label} <span style={{ fontWeight: 400 }}>({row.key})</span></dt>
              <dd style={{ margin: 0, whiteSpace: "nowrap", fontSize: 16, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "var(--color-primary)" }}>
                {fmt(params[row.key], 1)} <span style={{ fontSize: 12, fontWeight: 400, color: "var(--color-secondary)" }}>{row.unit}</span>
              </dd>
            </div>
            <p style={{ fontSize: 12, lineHeight: 1.5, color: "var(--color-dim)", margin: "3px 0 0" }}>{row.description}</p>
          </div>
        ))}
      </dl>
      <p style={{ fontSize: 12, lineHeight: 1.5, margin: "4px 0 12px", color: "var(--color-dim)" }}>These are model estimates. The volumes are not measurements of body-fluid volume.</p>
      {!isRetiredModel && (
        <details style={{ border: "1px solid var(--color-border)", borderRadius: 6, padding: "8px 10px", marginBottom: 12 }}>
          <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--color-primary)" }}>Equations and calculation details</summary>
          <p style={{ fontSize: 12, lineHeight: 1.5, color: "var(--color-secondary)" }}>The equations give the starting population estimates.{params.used_posterior_refinement ? " The results above also include adjustment using measured levels, so they may differ from these starting values." : ""}</p>
          {rows.map(row => (
            <section key={row.key} style={{ borderTop: "1px solid var(--color-border)", padding: "10px 0" }}>
              <h4 style={{ fontSize: 13, margin: "0 0 6px", color: "var(--color-primary)" }}>{PARAM_LABELS.find(p => p.key === row.key)?.label} ({row.key})</h4>
              <div style={equationStyle}>
                <p style={{ margin: "0 0 6px" }}>{row.equation}</p>
                <p style={{ margin: "0 0 6px" }}>{row.substitute(params)} = {fmt(row.prior(params), 1)} {row.unit} (starting estimate)</p>
                {row.key === "CL" && (
                  <details style={{ marginTop: 8 }}>
                    <summary style={{ cursor: "pointer" }}>Age and creatinine factors</summary>
                    <div style={{ paddingTop: 6 }}>
                      <p>{COLIN_2019.equations.PMA} = {fmt(covariates.PMA_yr, 2)}</p>
                      <p>{COLIN_2019.equations.FMat} = {f3(covariates.FMat)}</p>
                      <p>{COLIN_2019.equations.FDecline} = {f3(covariates.FDecline)}</p>
                      <p>{COLIN_2019.equations.SCRstd} = {f3(covariates.SCRstd)}</p>
                      <p>{COLIN_2019.equations.FSCR} = {f3(covariates.FSCR)}</p>
                      <p>For this model calculation, serum creatinine below {MIN_SCR_MG_DL} mg/dL is set to {MIN_SCR_MG_DL} mg/dL.</p>
                    </div>
                  </details>
                )}
              </div>
            </section>
          ))}
        </details>
      )}
      {!isRetiredModel && (
        <p style={{ fontSize: 12, lineHeight: 1.5, margin: 0, color: "var(--color-dim)" }}>
          {COLIN_2019.citation}{" "}
          <a href={`https://doi.org/${COLIN_2019.doi}`} target="_blank" rel="noopener noreferrer" style={{ color: "var(--color-primary)", textDecoration: "underline" }}>Read the model study</a>
        </p>
      )}
    </section>
  );
}
