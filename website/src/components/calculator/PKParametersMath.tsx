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
}

interface PKParametersMathProps {
  params: PKParams;
}

const STORAGE_KEY = "vancomyzer_show_math";

const PARAM_ROWS: {
  key: keyof Pick<PKParams, "CL" | "V1" | "Q" | "V2">;
  label: string;
  unit: string;
  equation: string;
  substitute: (p: PKParams) => string;
}[] = [
  {
    key: "CL",
    label: "CL",
    unit: "L/h",
    equation: "CL = 4.49 \u00d7 (1 - 0.00554 \u00d7 (Age - 35)) \u00d7 (SCr / 0.9)^-0.223 \u00d7 (WT / 70)^0.806",
    substitute: (p) => {
      const age = p.age ?? "?";
      const wt = p.weight_kg ?? "?";
      return `4.49 \u00d7 (1 - 0.00554 \u00d7 (${age} - 35)) \u00d7 (${p.scr} / 0.9)^\u207b\u00b2\u00b2\u00b3 \u00d7 (${wt} / 70)\u2070\u00b7\u2078\u2070\u2076`;
    },
  },
  {
    key: "V1",
    label: "V1",
    unit: "L",
    equation: "V1 = 40.6 \u00d7 (WT / 70)^1.00",
    substitute: (p) => {
      const wt = p.weight_kg ?? "?";
      return `40.6 \u00d7 (${wt} / 70)\u00b9\u00b7\u2070\u2070`;
    },
  },
  {
    key: "Q",
    label: "Q",
    unit: "L/h",
    equation: "Q = 3.87 \u00d7 (WT / 70)^0.806",
    substitute: (p) => {
      const wt = p.weight_kg ?? "?";
      return `3.87 \u00d7 (${wt} / 70)\u2070\u00b7\u2078\u2070\u2076`;
    },
  },
  {
    key: "V2",
    label: "V2",
    unit: "L",
    equation: "V2 = 37.6 \u00d7 (WT / 70)^1.00",
    substitute: (p) => {
      const wt = p.weight_kg ?? "?";
      return `37.6 \u00d7 (${wt} / 70)\u00b9\u00b7\u2070\u2070`;
    },
  },
];

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

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: "var(--color-primary)", margin: 0 }}>
          PK Parameters <span style={{ color: "var(--color-dim)", fontWeight: 500 }}>(Colin 2019)</span>
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
          {PARAM_ROWS.map((row, i) => {
            const value = params[row.key];
            return (
              <div key={row.key} style={{ borderTop: i === 0 ? "none" : "1px solid var(--color-border)", padding: "4px 0" }}>
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
      </div>
    </div>
  );
}
