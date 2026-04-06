"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface Patient {
  study_id: string;
  age: number;
  sex: string;
  bmi: number;
  crcl_baseline: number;
  icu_admission: number;
  indication: string;
  meets_inclusion: number;
  exclusion_reasons: string;
  weight_kg: number;
  height_cm: number;
  ffm_kg: number;
  ethnicity: string;
}

interface Summary {
  total: number;
  eligible: number;
  excluded: number;
  obesity_subgroup: number;
  exclusion_breakdown: Record<string, number>;
  descriptive?: {
    age: { median: number; q1: number; q3: number };
    weight: { median: number; q1: number; q3: number };
    bmi: { median: number; q1: number; q3: number };
    ffm: { median: number; q1: number; q3: number };
    crcl: { median: number; q1: number; q3: number };
    sex_counts: Record<string, number>;
    ethnicity_counts: Record<string, number>;
    icu_count: number;
    indication_counts: Record<string, number>;
    obesity_class_counts: Record<string, number>;
  };
  validation?: {
    a_priori?: { mpe: number; rmse: number; nrmse: number; pct_within_20: number };
    a_posteriori?: { mpe: number; rmse: number; nrmse: number; pct_within_20: number };
  };
}

/* ------------------------------------------------------------------ */
/*  Style helpers (admin-panel pattern)                               */
/* ------------------------------------------------------------------ */

const NAVY = "#1e4d8c";
const GREEN = "#047857";
const RED = "#991b1b";
const AMBER = "#b45309";
const GRAY = "#718096";
const LIGHT_BORDER = "#e2e8f0";
const BG_CARD = "#fff";
const BG_PAGE = "#f7fafc";

const card: React.CSSProperties = {
  background: BG_CARD,
  border: `1px solid ${LIGHT_BORDER}`,
  borderRadius: 8,
  padding: "20px 24px",
  marginBottom: 20,
};

const sectionTitle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  color: NAVY,
  marginBottom: 12,
  marginTop: 0,
};

const th: React.CSSProperties = {
  padding: "8px 12px",
  textAlign: "left",
  fontSize: 12,
  fontWeight: 600,
  color: NAVY,
  borderBottom: `2px solid #cbd5e0`,
  background: BG_PAGE,
};

const td: React.CSSProperties = {
  padding: "8px 12px",
  fontSize: 12,
  color: "#2d3748",
  borderBottom: `1px solid ${LIGHT_BORDER}`,
};

const badge = (pass: boolean): React.CSSProperties => ({
  display: "inline-block",
  padding: "2px 8px",
  borderRadius: 4,
  fontSize: 11,
  fontWeight: 600,
  color: "#fff",
  background: pass ? GREEN : RED,
});

const exportBtn: React.CSSProperties = {
  padding: "8px 16px",
  fontSize: 12,
  fontWeight: 600,
  border: `1px solid ${LIGHT_BORDER}`,
  cursor: "pointer",
  borderRadius: 6,
  color: NAVY,
  background: "#fff",
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function pct(n: number, total: number) {
  if (!total) return 0;
  return Math.round((n / total) * 100);
}

function ProgressBar({ value, target, color }: { value: number; target: number; color: string }) {
  const p = Math.min(100, pct(value, target));
  return (
    <div style={{ background: "#e2e8f0", borderRadius: 4, height: 14, position: "relative", overflow: "hidden" }}>
      <div style={{ width: `${p}%`, background: color, height: "100%", borderRadius: 4, transition: "width 0.4s ease" }} />
      <span style={{ position: "absolute", right: 6, top: 0, fontSize: 10, fontWeight: 600, lineHeight: "14px", color: p > 60 ? "#fff" : "#2d3748" }}>
        {value}/{target}
      </span>
    </div>
  );
}

function IQR({ label, data }: { label: string; data?: { median: number; q1: number; q3: number } }) {
  if (!data) return <span style={{ color: GRAY, fontSize: 12 }}>{label}: ---</span>;
  return (
    <span style={{ fontSize: 12, color: "#2d3748" }}>
      <strong>{label}:</strong> {data.median.toFixed(1)} ({data.q1.toFixed(1)}--{data.q3.toFixed(1)})
    </span>
  );
}

function CountTable({ label, counts }: { label: string; counts?: Record<string, number> }) {
  if (!counts || Object.keys(counts).length === 0)
    return <div style={{ fontSize: 12, color: GRAY, marginBottom: 4 }}>{label}: ---</div>;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: NAVY, marginBottom: 2 }}>{label}</div>
      {Object.entries(counts).map(([k, v]) => (
        <div key={k} style={{ fontSize: 12, color: "#2d3748", paddingLeft: 8 }}>
          {k}: {v}
        </div>
      ))}
    </div>
  );
}

function ValidationRow({ label, metrics }: { label: string; metrics?: { mpe: number; rmse: number; nrmse: number; pct_within_20: number } }) {
  const mpePass = metrics ? Math.abs(metrics.mpe) <= 20 : false;
  const nrmsePass = metrics ? metrics.nrmse < 8 : false;
  const w20Pass = metrics ? metrics.pct_within_20 >= 50 : false;

  return (
    <tr>
      <td style={td}><strong>{label}</strong></td>
      <td style={td}>
        {metrics ? (
          <span>
            {metrics.mpe.toFixed(1)}% <span style={badge(mpePass)}>{mpePass ? "PASS" : "FAIL"}</span>
          </span>
        ) : "---"}
      </td>
      <td style={td}>{metrics ? metrics.rmse.toFixed(2) : "---"}</td>
      <td style={td}>
        {metrics ? (
          <span>
            {metrics.nrmse.toFixed(2)} <span style={badge(nrmsePass)}>{nrmsePass ? "PASS" : "FAIL"}</span>
          </span>
        ) : "---"}
      </td>
      <td style={td}>
        {metrics ? (
          <span>
            {metrics.pct_within_20.toFixed(1)}% <span style={badge(w20Pass)}>{w20Pass ? "PASS" : "FAIL"}</span>
          </span>
        ) : "---"}
      </td>
    </tr>
  );
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export default function ResearchDashboard() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/research");
      if (!res.ok) {
        setError(`Failed to fetch research data (${res.status}).`);
        setLoading(false);
        return;
      }
      const data = await res.json();
      setPatients(data.patients ?? []);
      setSummary(data.summary ?? null);
    } catch (err) {
      setError("Network error fetching research data.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* ---- Export handler ---- */
  const handleExport = async (filter: string, format: string, filename: string) => {
    try {
      const res = await fetch(`/api/research/export?filter=${filter}&format=${format}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? `Export failed (${res.status}).`);
        return;
      }
      if (format === "summary") {
        const data = await res.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        downloadBlob(blob, filename);
      } else {
        const blob = await res.blob();
        downloadBlob(blob, filename);
      }
    } catch {
      alert("Export request failed.");
    }
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  /* ---- Render ---- */
  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: GRAY, fontFamily: "system-ui, sans-serif" }}>
        Loading research dashboard...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: RED, fontFamily: "system-ui, sans-serif" }}>
        {error}
      </div>
    );
  }

  const s = summary;
  const d = s?.descriptive;

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 16px 80px", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: NAVY, margin: 0 }}>Research Dashboard</h1>
          <p style={{ fontSize: 13, color: GRAY, margin: "4px 0 0" }}>Vancomyzer PK Validation Study</p>
        </div>
        <Link
          href="/research/enter"
          style={{
            padding: "10px 20px",
            fontSize: 13,
            fontWeight: 600,
            border: "none",
            borderRadius: 6,
            color: "#fff",
            background: NAVY,
            textDecoration: "none",
            display: "inline-block",
          }}
        >
          + Add Patient
        </Link>
      </div>

      {/* ---- Panel 1: Enrollment Tracker ---- */}
      <div style={card}>
        <h2 style={sectionTitle}>Enrollment Tracker</h2>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 700, color: NAVY }}>{s?.total ?? 0}</div>
            <div style={{ fontSize: 11, color: GRAY }}>Total Records</div>
          </div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 700, color: GREEN }}>{s?.eligible ?? 0}</div>
            <div style={{ fontSize: 11, color: GRAY }}>Eligible</div>
          </div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 700, color: RED }}>{s?.excluded ?? 0}</div>
            <div style={{ fontSize: 11, color: GRAY }}>Excluded</div>
          </div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 700, color: AMBER }}>{s?.obesity_subgroup ?? 0}</div>
            <div style={{ fontSize: 11, color: GRAY }}>Obesity (BMI &ge; 40)</div>
          </div>
        </div>

        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 11, color: GRAY, marginBottom: 2 }}>Total enrollment (target: 200-400)</div>
          <ProgressBar value={s?.total ?? 0} target={400} color={NAVY} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: GRAY, marginBottom: 2 }}>Obesity subgroup (minimum: 80)</div>
          <ProgressBar value={s?.obesity_subgroup ?? 0} target={80} color={AMBER} />
        </div>

        {s?.exclusion_breakdown && Object.keys(s.exclusion_breakdown).length > 0 && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: NAVY, marginBottom: 4 }}>Exclusion Reasons</div>
            {Object.entries(s.exclusion_breakdown).map(([reason, count]) => (
              <div key={reason} style={{ fontSize: 12, color: "#2d3748", paddingLeft: 8, marginBottom: 2 }}>
                {reason}: <strong>{count}</strong>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ---- Panel 2: Live Descriptive Statistics ---- */}
      <div style={card}>
        <h2 style={sectionTitle}>Live Descriptive Statistics</h2>

        {!d ? (
          <div style={{ fontSize: 13, color: GRAY }}>No data available yet.</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            {/* Left: continuous variables */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: NAVY, marginBottom: 6 }}>Continuous (Median, IQR)</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <IQR label="Age (yr)" data={d.age} />
                <IQR label="Weight (kg)" data={d.weight} />
                <IQR label="BMI (kg/m2)" data={d.bmi} />
                <IQR label="FFM (kg)" data={d.ffm} />
                <IQR label="CrCl (mL/min)" data={d.crcl} />
              </div>
            </div>
            {/* Right: categorical */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: NAVY, marginBottom: 6 }}>Categorical (n)</div>
              <CountTable label="Sex" counts={d.sex_counts} />
              <CountTable label="Ethnicity" counts={d.ethnicity_counts} />
              <div style={{ fontSize: 12, color: "#2d3748", marginBottom: 4 }}>ICU: {d.icu_count ?? 0}</div>
              <CountTable label="Obesity Class" counts={d.obesity_class_counts} />
              <CountTable label="Indication" counts={d.indication_counts} />
            </div>
          </div>
        )}
      </div>

      {/* ---- Panel 3: Validation Metrics (Aim 1) ---- */}
      <div style={card}>
        <h2 style={sectionTitle}>Validation Metrics (Aim 1)</h2>
        <div style={{ fontSize: 11, color: GRAY, marginBottom: 8 }}>
          Hughes 2024 thresholds: MPE within +/-20%, nRMSE &lt; 8, &ge; 50% within +/-20%
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", border: `1px solid ${LIGHT_BORDER}` }}>
            <thead>
              <tr>
                <th style={th}>Method</th>
                <th style={th}>MPE (%)</th>
                <th style={th}>RMSE</th>
                <th style={th}>nRMSE</th>
                <th style={th}>% Within +/-20%</th>
              </tr>
            </thead>
            <tbody>
              <ValidationRow label="A Priori" metrics={s?.validation?.a_priori} />
              <ValidationRow label="A Posteriori" metrics={s?.validation?.a_posteriori} />
            </tbody>
          </table>
        </div>
      </div>

      {/* ---- Panel 4: Export Center ---- */}
      <div style={card}>
        <h2 style={sectionTitle}>Export Center</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <button style={exportBtn} onClick={() => handleExport("all", "csv", "vancomyzer_complete.csv")}>
            Complete Dataset CSV
          </button>
          <button style={exportBtn} onClick={() => handleExport("eligible", "csv", "vancomyzer_eligible.csv")}>
            Eligible-Only CSV
          </button>
          <button style={exportBtn} onClick={() => handleExport("obesity", "csv", "vancomyzer_obesity.csv")}>
            Obesity Subgroup CSV
          </button>
          <button style={exportBtn} onClick={() => handleExport("all", "summary", "vancomyzer_summary.json")}>
            Summary JSON
          </button>
          <button style={exportBtn} onClick={() => handleExport("all", "csv", "vancomyzer_audit_log.csv")}>
            Audit Log CSV
          </button>
        </div>
      </div>

      {/* ---- Patient Table ---- */}
      <div style={card}>
        <h2 style={sectionTitle}>Patient Records ({patients.length})</h2>
        {patients.length === 0 ? (
          <div style={{ fontSize: 13, color: GRAY }}>No patients enrolled yet.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", border: `1px solid ${LIGHT_BORDER}` }}>
              <thead>
                <tr>
                  <th style={th}>Study ID</th>
                  <th style={th}>Age</th>
                  <th style={th}>Sex</th>
                  <th style={th}>BMI</th>
                  <th style={th}>CrCl</th>
                  <th style={th}>ICU</th>
                  <th style={th}>Indication</th>
                  <th style={th}>Eligible</th>
                  <th style={th}>Exclusion Reasons</th>
                </tr>
              </thead>
              <tbody>
                {patients.map((p) => {
                  const exclusions = (() => {
                    try {
                      return JSON.parse(p.exclusion_reasons);
                    } catch {
                      return [];
                    }
                  })();
                  return (
                    <tr key={p.study_id}>
                      <td style={td}>
                        <Link
                          href={`/research/patient/${p.study_id}`}
                          style={{ color: NAVY, fontWeight: 600, textDecoration: "none" }}
                        >
                          {p.study_id}
                        </Link>
                      </td>
                      <td style={td}>{p.age}</td>
                      <td style={td}>{p.sex}</td>
                      <td style={td}>{p.bmi?.toFixed(1)}</td>
                      <td style={td}>{p.crcl_baseline?.toFixed(1)}</td>
                      <td style={td}>{p.icu_admission ? "Yes" : "No"}</td>
                      <td style={td}>{p.indication}</td>
                      <td style={td}>
                        <span style={badge(p.meets_inclusion === 1)}>
                          {p.meets_inclusion === 1 ? "ELIGIBLE" : "EXCLUDED"}
                        </span>
                      </td>
                      <td style={{ ...td, fontSize: 11, color: GRAY }}>
                        {exclusions.length > 0 ? exclusions.join(", ") : "---"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
