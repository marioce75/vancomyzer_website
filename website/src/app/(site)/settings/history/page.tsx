"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useFeature } from "@/hooks/useFeature";

interface HistoryRow {
  id: number;
  calculated_at: string;
  workflow_type: string;
  pk_model: string;
  obesity_model_active: number;
  dose_mg: number | null;
  interval_hours: number | null;
  auc24: number | null;
  peak: number | null;
  trough: number | null;
  auc_in_range: number;
  case_id: string | null;
  tier_at_time: string | null;
}

interface HistoryResponse {
  rows: HistoryRow[];
  total: number;
}

const PAGE_SIZE = 50;

function formatDate(iso: string): string {
  try {
    const d = new Date(iso.includes("T") || iso.includes("Z") ? iso : iso.replace(" ", "T") + "Z");
    return d.toLocaleString(undefined, {
      year: "numeric", month: "short", day: "numeric",
      hour: "numeric", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function workflowLabel(t: string): string {
  if (t === "empiric") return "Initial regimen";
  if (t === "existing") return "Adjustment (with levels)";
  return t;
}

function HistoryUpgradeCard() {
  return (
    <div style={{
      padding: 20,
      background: "var(--color-card)",
      border: "2px solid var(--color-primary)",
      borderRadius: 6,
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-primary)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>
        Calculation history is a Pro feature
      </div>
      <p style={{ fontSize: 14, color: "var(--color-secondary)", margin: "0 0 16px", lineHeight: 1.6 }}>
        Pro users get 90 days of de-identified calculation history with optional case IDs for tracking
        — search, review, and re-export prior calcs without re-entering patient data.
      </p>
      <ul style={{ margin: "0 0 16px", padding: 0, listStyle: "none", fontSize: 13, color: "var(--color-secondary)", lineHeight: 1.7 }}>
        <li style={{ paddingLeft: 18, position: "relative" }}>
          <span style={{ position: "absolute", left: 0, color: "#0d9488", fontWeight: 700 }}>✓</span>
          Optional case IDs (no PHI — sanitized at write time)
        </li>
        <li style={{ paddingLeft: 18, position: "relative" }}>
          <span style={{ position: "absolute", left: 0, color: "#0d9488", fontWeight: 700 }}>✓</span>
          Filter by workflow, date, case ID
        </li>
        <li style={{ paddingLeft: 18, position: "relative" }}>
          <span style={{ position: "absolute", left: 0, color: "#0d9488", fontWeight: 700 }}>✓</span>
          90-day retention, automatically purged
        </li>
      </ul>
      <Link
        href="/settings/billing"
        style={{
          display: "inline-block",
          padding: "10px 20px",
          fontSize: 13,
          fontWeight: 600,
          background: "var(--color-primary)",
          color: "#ffffff",
          borderRadius: 4,
          textDecoration: "none",
        }}
      >
        Start 14-Day Trial
      </Link>
    </div>
  );
}

export default function HistoryPage() {
  const { user, loading: authLoading } = useAuth();
  const { allowed } = useFeature("history.calculation");

  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [workflowFilter, setWorkflowFilter] = useState<string>("");
  const [caseIdFilter, setCaseIdFilter] = useState("");

  useEffect(() => {
    if (!user || !allowed) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String(offset),
    });
    if (workflowFilter) params.set("workflow_type", workflowFilter);
    if (caseIdFilter) params.set("case_id", caseIdFilter);
    fetch(`/api/history?${params.toString()}`)
      .then(r => r.json())
      .then((data: HistoryResponse) => {
        if (cancelled) return;
        setRows(data.rows);
        setTotal(data.total);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load history.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [user, allowed, offset, workflowFilter, caseIdFilter]);

  if (authLoading) {
    return <div style={{ padding: 40, textAlign: "center", color: "var(--color-dim)" }}>Loading...</div>;
  }
  if (!user) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <p style={{ color: "var(--color-secondary)" }}>
          Please <Link href="/login" style={{ color: "var(--color-primary)" }}>sign in</Link> to view your calculation history.
        </p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px 16px 80px" }}>
      <div style={{ display: "flex", gap: 16, fontSize: 13, marginBottom: 16, flexWrap: "wrap" }}>
        <Link href="/settings" style={{ color: "var(--color-dim)", textDecoration: "none" }}>
          ← Institutional Settings
        </Link>
        <span style={{ color: "var(--color-border)" }}>·</span>
        <Link href="/settings/billing" style={{ color: "var(--color-dim)", textDecoration: "none" }}>
          Billing
        </Link>
        <span style={{ color: "var(--color-border)" }}>·</span>
        <span style={{ color: "var(--color-primary)", fontWeight: 600 }}>History</span>
      </div>

      <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--color-primary)", marginBottom: 4 }}>
        Calculation History
      </h1>
      <p style={{ fontSize: 13, color: "var(--color-dim)", marginBottom: 24 }}>
        90-day de-identified record of your Vancomyzer&trade; calculations. No patient identifiers stored.
      </p>

      {!allowed ? (
        <HistoryUpgradeCard />
      ) : (
        <>
          {/* Filters */}
          <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--color-secondary)", marginBottom: 4 }}>
                Workflow
              </label>
              <select
                value={workflowFilter}
                onChange={e => { setOffset(0); setWorkflowFilter(e.target.value); }}
                style={{
                  padding: "6px 10px", fontSize: 13,
                  border: "1px solid var(--color-border)", background: "var(--color-card)", color: "var(--color-primary)",
                  borderRadius: 4,
                }}
              >
                <option value="">All</option>
                <option value="empiric">Initial regimen</option>
                <option value="existing">Adjustment</option>
              </select>
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--color-secondary)", marginBottom: 4 }}>
                Case ID search
              </label>
              <input
                type="text"
                value={caseIdFilter}
                onChange={e => { setOffset(0); setCaseIdFilter(e.target.value); }}
                placeholder="e.g. ICU bed 12"
                style={{
                  width: "100%", padding: "6px 10px", fontSize: 13,
                  border: "1px solid var(--color-border)", background: "var(--color-card)", color: "var(--color-primary)",
                  borderRadius: 4, boxSizing: "border-box",
                }}
              />
            </div>
            <div style={{ alignSelf: "flex-end", fontSize: 12, color: "var(--color-dim)" }}>
              {total} {total === 1 ? "entry" : "entries"}
            </div>
          </div>

          {error && (
            <div style={{
              padding: "10px 14px", marginBottom: 16,
              background: "#fff5f5", border: "1px solid #fca5a5", color: "#991b1b", fontSize: 13, borderRadius: 4,
            }}>
              {error}
            </div>
          )}

          {/* Table */}
          {loading && rows.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--color-dim)" }}>Loading history...</div>
          ) : rows.length === 0 ? (
            <div style={{
              padding: 32, textAlign: "center", color: "var(--color-dim)", fontSize: 13,
              border: "1px dashed var(--color-border)", borderRadius: 6,
            }}>
              No calculations yet. New calculations will appear here.
            </div>
          ) : (
            <div style={{ overflowX: "auto", border: "1px solid var(--color-border)", borderRadius: 6, background: "var(--color-card)" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "var(--color-bg)", borderBottom: "1px solid var(--color-border)" }}>
                    {["Date", "Workflow", "Case ID", "Model", "Dose", "Interval", "AUC₂₄", "Peak", "Trough", "Range"].map(h => (
                      <th key={h} style={{
                        padding: "10px 12px", textAlign: "left", fontSize: 11, fontWeight: 700,
                        color: "var(--color-secondary)", letterSpacing: "0.06em", textTransform: "uppercase",
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => (
                    <tr key={row.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                      <td style={{ padding: "10px 12px", color: "var(--color-secondary)", whiteSpace: "nowrap" }}>
                        {formatDate(row.calculated_at)}
                      </td>
                      <td style={{ padding: "10px 12px", color: "var(--color-primary)" }}>
                        {workflowLabel(row.workflow_type)}
                      </td>
                      <td style={{ padding: "10px 12px", color: "var(--color-secondary)", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis" }}>
                        {row.case_id ?? <span style={{ color: "var(--color-dim)" }}>—</span>}
                      </td>
                      <td style={{ padding: "10px 12px", color: "var(--color-secondary)", whiteSpace: "nowrap" }}>
                        {row.pk_model === "vancomyzer_obesity" ? "Obesity" : "Colin 2019"}
                      </td>
                      <td style={{ padding: "10px 12px", color: "var(--color-primary)", fontWeight: 600 }}>
                        {row.dose_mg != null ? `${row.dose_mg} mg` : "—"}
                      </td>
                      <td style={{ padding: "10px 12px", color: "var(--color-secondary)" }}>
                        {row.interval_hours != null ? `q${row.interval_hours}h` : "—"}
                      </td>
                      <td style={{ padding: "10px 12px", color: "var(--color-secondary)" }}>
                        {row.auc24 != null ? row.auc24.toFixed(0) : "—"}
                      </td>
                      <td style={{ padding: "10px 12px", color: "var(--color-secondary)" }}>
                        {row.peak != null ? row.peak.toFixed(1) : "—"}
                      </td>
                      <td style={{ padding: "10px 12px", color: "var(--color-secondary)" }}>
                        {row.trough != null ? row.trough.toFixed(1) : "—"}
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        {row.auc_in_range ? (
                          <span style={{ display: "inline-block", padding: "2px 8px", fontSize: 11, fontWeight: 600, background: "#ecfdf5", color: "#047857", border: "1px solid #6ee7b7", borderRadius: 4 }}>
                            In
                          </span>
                        ) : (
                          <span style={{ display: "inline-block", padding: "2px 8px", fontSize: 11, fontWeight: 600, background: "#fef3c7", color: "#92400e", border: "1px solid #fcd34d", borderRadius: 4 }}>
                            Out
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {total > PAGE_SIZE && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16, fontSize: 13 }}>
              <button
                type="button"
                disabled={offset === 0 || loading}
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                style={{
                  padding: "6px 14px",
                  background: "transparent",
                  border: "1px solid var(--color-border)",
                  color: offset === 0 ? "var(--color-dim)" : "var(--color-primary)",
                  borderRadius: 4,
                  cursor: offset === 0 ? "not-allowed" : "pointer",
                }}
              >
                ← Newer
              </button>
              <span style={{ color: "var(--color-dim)" }}>
                {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}
              </span>
              <button
                type="button"
                disabled={offset + PAGE_SIZE >= total || loading}
                onClick={() => setOffset(offset + PAGE_SIZE)}
                style={{
                  padding: "6px 14px",
                  background: "transparent",
                  border: "1px solid var(--color-border)",
                  color: offset + PAGE_SIZE >= total ? "var(--color-dim)" : "var(--color-primary)",
                  borderRadius: 4,
                  cursor: offset + PAGE_SIZE >= total ? "not-allowed" : "pointer",
                }}
              >
                Older →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
