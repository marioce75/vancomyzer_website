"use client";

import { useEffect, useState } from "react";

interface PilotRow {
  id: string;
  user: { name: string | null; email: string | null };
  startedAt: string;
  expiresAt: string;
  daysElapsed: number;
  phase: string;
  status: string;
  totalCases: number;
  obesityActivations: number;
  aucTargetAttainmentRate: number | null;
  reportGenerated: boolean;
  reportUrl: string | null;
  convertedAt: string | null;
}

const PHASE_LABELS: Record<string, string> = {
  PHASE_1: "Phase 1",
  PHASE_2: "Phase 2",
  PHASE_3: "Phase 3",
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  ACTIVE:    { bg: "#dcfce7", text: "#166534" },
  EXPIRED:   { bg: "#fee2e2", text: "#991b1b" },
  CONVERTED: { bg: "#dbeafe", text: "#1e40af" },
  CHURNED:   { bg: "#f3f4f6", text: "#374151" },
};

export default function PilotsPage() {
  const [pilots, setPilots] = useState<PilotRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/trials")
      .then(r => r.json())
      .then(data => { setPilots(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const active = pilots.filter(p => p.status === "ACTIVE").length;
  const converted = pilots.filter(p => p.status === "CONVERTED").length;
  const totalCases = pilots.reduce((s, p) => s + p.totalCases, 0);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1" style={{ color: "#1e4d8c" }}>Active Pilots</h1>
      <p className="text-sm text-gray-500 mb-6">90-day free trial tracking and conversion status</p>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: "Active Pilots", value: active },
          { label: "Conversions", value: converted },
          { label: "Total Cases Logged", value: totalCases },
        ].map(card => (
          <div key={card.label} className="bg-white border border-gray-200 rounded-lg p-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{card.label}</p>
            <span className="text-2xl font-bold" style={{ color: "#1e4d8c" }}>{card.value}</span>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="text-gray-400 text-sm py-12 text-center">Loading pilot data…</div>
      ) : pilots.length === 0 ? (
        <div className="text-gray-400 text-sm py-12 text-center">No pilot trials found.</div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                {["User", "Started", "Day", "Phase", "Status", "Cases", "AUC Attainment", "Obesity", "Report", "Converted"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pilots.map(p => {
                const sc = STATUS_COLORS[p.status] ?? { bg: "#f3f4f6", text: "#374151" };
                return (
                  <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{p.user.name ?? "—"}</div>
                      <div className="text-xs text-gray-400">{p.user.email ?? "—"}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{new Date(p.startedAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3 font-mono text-gray-700">{p.daysElapsed}</td>
                    <td className="px-4 py-3 text-gray-600">{PHASE_LABELS[p.phase] ?? p.phase}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: sc.bg, color: sc.text }}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-700">{p.totalCases}</td>
                    <td className="px-4 py-3 font-mono text-gray-700">
                      {p.aucTargetAttainmentRate != null ? `${p.aucTargetAttainmentRate}%` : "—"}
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-700">{p.obesityActivations}</td>
                    <td className="px-4 py-3">
                      {p.reportGenerated && p.reportUrl ? (
                        <a href={p.reportUrl} target="_blank" rel="noopener" className="text-blue-600 hover:underline text-xs">
                          View PDF
                        </a>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">
                      {p.convertedAt ? new Date(p.convertedAt).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
