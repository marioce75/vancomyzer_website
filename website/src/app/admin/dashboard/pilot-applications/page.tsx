"use client";

import { useState, useEffect, useCallback } from "react";

interface PilotApplication {
  id: number;
  contact_name: string;
  contact_title: string;
  hospital_name: string;
  email: string;
  phone: string | null;
  bed_count: number | null;
  current_monitoring: string | null;
  source: string;
  submitted_at: string;
  status: "pending" | "approved" | "rejected" | "archived";
  reviewed_at: string | null;
  reviewed_by: number | null;
  review_notes: string | null;
  tenant_id: number | null;
  created_at: string;
}

const STATUS_BADGE: Record<PilotApplication["status"], string> = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  archived: "bg-gray-100 text-gray-700",
};

const DEFAULT_SEATS = 10;
const DEFAULT_DAYS = 90;

export default function PilotApplicationsPage() {
  const [applications, setApplications] = useState<PilotApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected" | "archived">("pending");
  const [approveTarget, setApproveTarget] = useState<PilotApplication | null>(null);
  const [seats, setSeats] = useState(DEFAULT_SEATS);
  const [days, setDays] = useState(DEFAULT_DAYS);
  const [submitting, setSubmitting] = useState(false);

  const fetchApplications = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/pilot-applications");
      if (res.ok) {
        const data = await res.json();
        setApplications((data.applications ?? []) as PilotApplication[]);
      }
    } catch {
      /* ignore */
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  const post = async (body: Record<string, unknown>) => {
    setSubmitting(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/pilot-applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setMessage(data.message ?? data.error ?? "Done.");
      fetchApplications();
    } catch {
      setMessage("Request failed.");
    }
    setSubmitting(false);
  };

  const openApprove = (a: PilotApplication) => {
    setApproveTarget(a);
    setSeats(DEFAULT_SEATS);
    setDays(DEFAULT_DAYS);
  };

  const confirmApprove = async () => {
    if (!approveTarget) return;
    await post({ id: approveTarget.id, status: "approved", seats, durationDays: days });
    setApproveTarget(null);
  };

  const reject = async (id: number) => {
    const reason = prompt("Reason for rejection (sent to applicant if you confirm):");
    if (reason === null) return; // user cancelled
    await post({ id, status: "rejected", notes: reason });
  };

  const archive = (id: number) => post({ id, status: "archived" });

  const revoke = (a: PilotApplication) => {
    if (!confirm(`Revoke pilot for ${a.hospital_name}? All linked users will be disabled and the applicant will be emailed.`)) return;
    const notes = prompt("Internal note for the audit log (optional):") ?? "";
    void post({ id: a.id, action: "revoke", notes });
  };

  const visible =
    filter === "all" ? applications : applications.filter((a) => a.status === filter);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Pilot Applications</h1>
        <div className="flex gap-2">
          {(["pending", "approved", "rejected", "archived", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 text-xs font-semibold rounded ${
                filter === f
                  ? "bg-blue-700 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {f.toUpperCase()}
              {f !== "all" && (
                <span className="ml-1 opacity-70">
                  ({applications.filter((a) => a.status === f).length})
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {message && (
        <div className="mb-3 px-3 py-2 text-sm bg-blue-50 border border-blue-200 text-blue-800 rounded">
          {message}
        </div>
      )}

      {loading ? (
        <div className="text-gray-500">Loading…</div>
      ) : visible.length === 0 ? (
        <div className="text-gray-500 text-sm py-8 text-center bg-white border border-gray-200 rounded">
          No {filter === "all" ? "" : filter} applications.
        </div>
      ) : (
        <div className="overflow-x-auto bg-white border border-gray-200 rounded">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">#</th>
                <th className="px-3 py-2 text-left font-semibold">Hospital</th>
                <th className="px-3 py-2 text-left font-semibold">Contact</th>
                <th className="px-3 py-2 text-left font-semibold">Email</th>
                <th className="px-3 py-2 text-left font-semibold">Beds</th>
                <th className="px-3 py-2 text-left font-semibold">Monitoring</th>
                <th className="px-3 py-2 text-left font-semibold">Status</th>
                <th className="px-3 py-2 text-left font-semibold">Tenant</th>
                <th className="px-3 py-2 text-left font-semibold">Received</th>
                <th className="px-3 py-2 text-left font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((a) => (
                <tr key={a.id} className="border-t border-gray-100">
                  <td className="px-3 py-2 text-gray-500">{a.id}</td>
                  <td className="px-3 py-2 font-semibold text-gray-800">{a.hospital_name}</td>
                  <td className="px-3 py-2 text-gray-700">
                    {a.contact_name}
                    <span className="text-gray-400">, {a.contact_title}</span>
                  </td>
                  <td className="px-3 py-2 text-gray-600">
                    <a href={`mailto:${a.email}`} className="hover:underline">{a.email}</a>
                    {a.phone && <div className="text-xs text-gray-400">{a.phone}</div>}
                  </td>
                  <td className="px-3 py-2 text-gray-600">{a.bed_count ?? "—"}</td>
                  <td className="px-3 py-2 text-gray-600">{a.current_monitoring ?? "—"}</td>
                  <td className="px-3 py-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${STATUS_BADGE[a.status]}`}>
                      {a.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-600">
                    {a.tenant_id ? `#${a.tenant_id}` : "—"}
                  </td>
                  <td className="px-3 py-2 text-gray-500">
                    {new Date(a.created_at).toLocaleString()}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1 flex-wrap">
                      {a.status === "pending" && (
                        <>
                          <button
                            onClick={() => openApprove(a)}
                            disabled={submitting}
                            className="px-2 py-0.5 text-[10px] font-semibold text-white bg-green-700 rounded hover:bg-green-800 disabled:opacity-50"
                          >
                            APPROVE
                          </button>
                          <button
                            onClick={() => reject(a.id)}
                            disabled={submitting}
                            className="px-2 py-0.5 text-[10px] font-semibold text-white bg-red-700 rounded hover:bg-red-800 disabled:opacity-50"
                          >
                            REJECT
                          </button>
                        </>
                      )}
                      {a.status === "approved" && a.tenant_id && (
                        <button
                          onClick={() => revoke(a)}
                          disabled={submitting}
                          className="px-2 py-0.5 text-[10px] font-semibold text-white bg-red-700 rounded hover:bg-red-800 disabled:opacity-50"
                          title="Disables all linked users and ends the pilot."
                        >
                          REVOKE PILOT
                        </button>
                      )}
                      {(a.status === "rejected" || (a.status === "approved" && !a.tenant_id)) && (
                        <button
                          onClick={() => archive(a.id)}
                          disabled={submitting}
                          className="px-2 py-0.5 text-[10px] font-semibold text-gray-700 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50"
                        >
                          ARCHIVE
                        </button>
                      )}
                      {a.review_notes && (
                        <span
                          title={a.review_notes}
                          className="px-2 py-0.5 text-[10px] text-blue-700 bg-blue-50 rounded cursor-help"
                        >
                          NOTE
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-xs text-gray-500">
        APPROVE provisions a Hospital-tier sandbox tenant and emails a magic-link sign-in to the applicant.
        REJECT sends a polite decline. REVOKE PILOT disables all linked users and ends the pilot mid-cycle.
      </p>

      {/* APPROVE modal — choose seats + duration */}
      {approveTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h2 className="text-lg font-bold text-gray-900 mb-1">
              Approve pilot for {approveTarget.hospital_name}?
            </h2>
            <p className="text-xs text-gray-500 mb-4">
              Provisions a hospital-tier sandbox and sends a magic-link sign-in email to {approveTarget.email}.
            </p>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <label className="block">
                <span className="text-xs font-semibold text-gray-700">Seats</span>
                <input
                  type="number"
                  value={seats}
                  min={1}
                  max={500}
                  onChange={(e) => setSeats(Number(e.target.value) || DEFAULT_SEATS)}
                  className="mt-1 w-full px-2 py-1 text-sm border border-gray-300 rounded"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-gray-700">Pilot duration (days)</span>
                <input
                  type="number"
                  value={days}
                  min={1}
                  max={365}
                  onChange={(e) => setDays(Number(e.target.value) || DEFAULT_DAYS)}
                  className="mt-1 w-full px-2 py-1 text-sm border border-gray-300 rounded"
                />
              </label>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Pilot ends {new Date(Date.now() + days * 86400000).toLocaleDateString()}.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setApproveTarget(null)}
                disabled={submitting}
                className="px-3 py-1.5 text-sm font-semibold text-gray-700 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmApprove}
                disabled={submitting}
                className="px-3 py-1.5 text-sm font-semibold text-white bg-green-700 rounded hover:bg-green-800 disabled:opacity-50"
              >
                {submitting ? "Provisioning…" : "Approve & Provision"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
