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

const FONT: React.CSSProperties = { fontFamily: "'Share Tech Mono', monospace" };
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
      {/* Section header */}
      <div className="flex items-center justify-between mb-2">
        <p
          className="text-[10px] font-semibold uppercase tracking-[0.14em]"
          style={{ color: "var(--color-dim)", ...FONT }}
        >
          PK PARAMETERS (COLIN 2019)
        </p>
        <button
          type="button"
          onClick={toggleMath}
          style={{
            fontSize: 9,
            color: "var(--color-secondary)",
            background: "transparent",
            border: "1px solid var(--color-border)",
            padding: "2px 8px",
            cursor: "pointer",
            ...FONT,
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--color-primary-a40)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border)"; }}
        >
          {showMath ? "[HIDE MATH]" : "[SHOW MATH]"}
        </button>
      </div>

      {/* Parameter rows */}
      {PARAM_ROWS.map((row, i) => {
        const value = params[row.key];
        return (
          <div
            key={row.key}
            style={{
              borderTop: i === 0 ? "none" : "1px solid #003311",
              padding: "6px 0",
            }}
          >
            {/* Name + value */}
            <div className="flex items-baseline justify-between">
              <span style={{ fontSize: 12, color: "var(--color-secondary)", ...FONT }}>
                {row.label}
              </span>
              <span style={{ fontSize: 13, color: "var(--color-primary)", fontWeight: 700, ...FONT }}>
                {typeof value === "number" ? value.toFixed(1) : "—"}{" "}
                <span style={{ fontSize: 10, color: "var(--color-dim)", fontWeight: 400 }}>{row.unit}</span>
              </span>
            </div>

            {/* Equation (collapsible) */}
            {showMath && (
              <div style={{ marginTop: 3, overflow: "hidden" }}>
                <p style={{ fontSize: 10, color: "#007722", lineHeight: 1.5, ...FONT, margin: 0 }}>
                  {row.equation}
                </p>
                <p style={{ fontSize: 10, lineHeight: 1.5, ...FONT, margin: "2px 0 0 0" }}>
                  <span style={{ color: "#00aa33" }}>{row.substitute(params)}</span>
                  <span style={{ color: "var(--color-primary)" }}>
                    {" = "}{typeof value === "number" ? value.toFixed(1) : "?"} {row.unit}
                  </span>
                </p>
              </div>
            )}
          </div>
        );
      })}

      {/* Bayesian posterior note */}
      {showMath && params.used_posterior_refinement && (
        <p style={{ fontSize: 9, color: "#005522", fontStyle: "italic", marginTop: 6, ...FONT }}>
          {"\u21B3"} Individual estimates updated from population priors via Bayesian posterior
        </p>
      )}

      {/* Reference citation */}
      <div style={{ marginTop: 10, paddingTop: 6, borderTop: "1px solid #003311" }}>
        <p style={{ fontSize: 9, color: "#004411", lineHeight: 1.5, ...FONT, margin: 0 }}>
          Colin PJ et al. Clin Pharmacokinet. 2019;58(6):767-780
        </p>
        <a
          href="https://doi.org/10.1007/s40262-018-0727-5"
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: 9, color: "#004411", ...FONT, textDecoration: "none" }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.textDecoration = "underline"; (e.currentTarget as HTMLElement).style.color = "var(--color-secondary)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.textDecoration = "none"; (e.currentTarget as HTMLElement).style.color = "#004411"; }}
        >
          DOI: 10.1007/s40262-018-0727-5
        </a>
      </div>
    </div>
  );
}
