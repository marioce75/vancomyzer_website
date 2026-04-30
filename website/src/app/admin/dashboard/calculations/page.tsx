"use client";

import { useEffect, useState, useCallback } from "react";

interface Row {
  id: number;
  calculated_at: string;
  user_id: number;
  username: string | null;
  user_email: string | null;
  full_name: string | null;
  institutional_account_id: number | null;
  institution_name: string | null;
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

const PAGE_SIZE = 100;

function fmt(iso: string): string {
  try {
    const s = iso.includes("T") || iso.includes("Z") ? iso : iso.replace(" ", "T") + "Z";
    return new Date(s).toLocaleString(undefined, {
      year: "numeric", month: "short", day: "numeric",
      hour: "numeric", minute: "2-digit",
    });
  } catch { return iso; }
}

function workflowLabel(t: string): string {
  if (t === "empiric") return "Initial regimen";
  if (t === "existing") return "Adjustment";
  return t;
}

export default function AdminCalculationsPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [emailFilter, setEmailFilter] = useState("");
  const [institutionFilter, setInstitutionFilter] = useState("");
  const [workflowFilter, setWorkflowFilter] = useState("");
  const [modelFilter, setModelFilter] = useState("");
  const [offset, setOffset] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String(offset),
    });
    if (emailFilter.trim()) params.set("user_email", emailFilter.trim());
    if (institutionFilter.trim()) params.set("institutional_account_id", institutionFilter.trim());
    if (workflowFilter) params.set("workflow_type", workflowFilter);
    if (modelFilter) params.set("pk_model", modelFilter);
    try {
      const res = await fetch(`/api/admin/calculations?${params.toString()}`);
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Failed to load.");
        setRows(null);
        return;
      }
      setRows(body.rows);
      setTotal(body.total);
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }, [offset, emailFilter, institutionFilter, workflowFilter, modelFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-bold text-slate-900">Calculations Audit</h1>
        <p className="text-sm text-slate-600 mt-1">
          System-wide feed of calculation events. De-identified — no patient data is stored.
          Department admins see their own subset at <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">/team</code>.
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-md p-3 mb-4 grid grid-cols-2 md:grid-cols-5 gap-2">
        <div>
          <label className="block text-[11px] font-semibold text-slate-600 mb-1 uppercase tracking-wide">User email</label>
          <input
            type="text"
            value={emailFilter}
            onChange={e => { setOffset(0); setEmailFilter(e.target.value); }}
            placeholder="substring"
            className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded text-slate-900"
          />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-slate-600 mb-1 uppercase tracking-wide">Institution ID</label>
          <input
            type="number"
            value={institutionFilter}
            onChange={e => { setOffset(0); setInstitutionFilter(e.target.value); }}
            placeholder="numeric ID"
            className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded text-slate-900"
          />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-slate-600 mb-1 uppercase tracking-wide">Workflow</label>
          <select
            value={workflowFilter}
            onChange={e => { setOffset(0); setWorkflowFilter(e.target.value); }}
            className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded text-slate-900 bg-white"
          >
            <option value="">All</option>
            <option value="empiric">Initial regimen</option>
            <option value="existing">Adjustment</option>
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-slate-600 mb-1 uppercase tracking-wide">PK model</label>
          <select
            value={modelFilter}
            onChange={e => { setOffset(0); setModelFilter(e.target.value); }}
            className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded text-slate-900 bg-white"
          >
            <option value="">All</option>
            <option value="colin_2019">Colin 2019</option>
            <option value="vancomyzer_obesity">Obesity model</option>
          </select>
        </div>
        <div className="flex items-end">
          <span className="text-xs text-slate-500">{total} {total === 1 ? "entry" : "entries"}</span>
        </div>
      </div>

      {error && (
        <div className="mb-3 px-3 py-2 bg-rose-50 border border-rose-200 text-rose-800 text-sm rounded">{error}</div>
      )}

      {loading && rows === null ? (
        <div className="text-center py-12 text-slate-500 text-sm">Loading…</div>
      ) : rows && rows.length > 0 ? (
        <div className="bg-white border border-slate-200 rounded-md overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {["Date", "User", "Institution", "Tier", "Workflow", "Case ID", "Model", "Dose", "AUC", "Range"].map(h => (
                  <th key={h} className="px-3 py-2 text-left text-[11px] font-bold text-slate-600 uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2 text-slate-700 whitespace-nowrap">{fmt(row.calculated_at)}</td>
                  <td className="px-3 py-2 text-slate-900">
                    <div className="font-medium">{row.full_name ?? row.username ?? `User ${row.user_id}`}</div>
                    {row.user_email && <div className="text-xs text-slate-500">{row.user_email}</div>}
                  </td>
                  <td className="px-3 py-2 text-slate-700">
                    {row.institution_name ?? <span className="text-slate-400">— individual —</span>}
                  </td>
                  <td className="px-3 py-2 text-slate-700">
                    <span className="text-xs font-mono uppercase tracking-wide">{row.tier_at_time ?? "—"}</span>
                  </td>
                  <td className="px-3 py-2 text-slate-700">{workflowLabel(row.workflow_type)}</td>
                  <td className="px-3 py-2 text-slate-700 max-w-[160px] truncate">
                    {row.case_id ?? <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-3 py-2 text-slate-700">
                    {row.pk_model === "vancomyzer_obesity" ? "Obesity" : "Colin 2019"}
                  </td>
                  <td className="px-3 py-2 text-slate-900 font-medium whitespace-nowrap">
                    {row.dose_mg != null ? `${row.dose_mg} mg` : "—"}
                    {row.interval_hours != null && <span className="text-slate-500 font-normal"> / q{row.interval_hours}h</span>}
                  </td>
                  <td className="px-3 py-2 text-slate-700">{row.auc24 != null ? row.auc24.toFixed(0) : "—"}</td>
                  <td className="px-3 py-2">
                    {row.auc_in_range ? (
                      <span className="inline-block px-2 py-0.5 text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded">In</span>
                    ) : (
                      <span className="inline-block px-2 py-0.5 text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 rounded">Out</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-16 text-slate-500 text-sm border border-dashed border-slate-200 rounded">
          No calculations match the filters.
        </div>
      )}

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between mt-4 text-sm text-slate-600">
          <button
            type="button"
            disabled={offset === 0 || loading}
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            className="px-3 py-1.5 border border-slate-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100"
          >
            ← Newer
          </button>
          <span>{offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}</span>
          <button
            type="button"
            disabled={offset + PAGE_SIZE >= total || loading}
            onClick={() => setOffset(offset + PAGE_SIZE)}
            className="px-3 py-1.5 border border-slate-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100"
          >
            Older →
          </button>
        </div>
      )}
    </div>
  );
}
