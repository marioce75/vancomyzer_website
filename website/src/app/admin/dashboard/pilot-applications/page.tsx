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
  created_at: string;
}

const STATUS_BADGE: Record<PilotApplication["status"], string> = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  archived: "bg-gray-100 text-gray-700",
};

export default function PilotApplicationsPage() {
  const [applications, setApplications] = useState<PilotApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected" | "archived">("pending");

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

  const review = async (id: number, status: "approved" | "rejected" | "archived") => {
    const notes = status === "rejected" ? prompt("Reason (optional):") ?? "" : "";
    setMessage("");
    try {
      const res = await fetch("/api/admin/pilot-applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status, notes }),
      });
      const data = await res.json();
      setMessage(data.message ?? data.error ?? "Done.");
      fetchApplications();
    } catch {
      setMessage("Request failed.");
    }
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
                  <td className="px-3 py-2 text-gray-500">
                    {new Date(a.created_at).toLocaleString()}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1 flex-wrap">
                      {a.status === "pending" && (
                        <>
                          <button
                            onClick={() => review(a.id, "approved")}
                            className="px-2 py-0.5 text-[10px] font-semibold text-white bg-green-700 rounded hover:bg-green-800"
                            title="Phase 1: marks status only. Provisioning lands in Phase 2."
                          >
                            APPROVE
                          </button>
                          <button
                            onClick={() => review(a.id, "rejected")}
                            className="px-2 py-0.5 text-[10px] font-semibold text-white bg-red-700 rounded hover:bg-red-800"
                          >
                            REJECT
                          </button>
                        </>
                      )}
                      {(a.status === "approved" || a.status === "rejected") && (
                        <button
                          onClick={() => review(a.id, "archived")}
                          className="px-2 py-0.5 text-[10px] font-semibold text-gray-700 bg-gray-200 rounded hover:bg-gray-300"
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
        Phase 1: APPROVE/REJECT records the decision only. Phase 2 will auto-provision a hospital-tier sandbox tenant and send the magic-link onboarding email on approval.
      </p>
    </div>
  );
}
