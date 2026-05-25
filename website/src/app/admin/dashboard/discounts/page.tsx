"use client";

/**
 * Superadmin discount queue — pending student/resident applications
 * awaiting approve/deny. Auto-verified school-email signups skip this
 * queue entirely; manual applicants land here.
 *
 * Auth is enforced server-side by /api/admin/discounts/* (role='admin').
 */

import { useCallback, useEffect, useState } from "react";

interface PendingRow {
  id: number;
  user_id: number;
  discount_type: "student" | "resident";
  status: "pending";
  application_data: string | null;
  created_at: string;
  username: string;
  email: string;
  full_name: string;
}

interface ApplicationData {
  discount_type?: string;
  program_name?: string;
  institution_name?: string;
  supervisor_name?: string;
  supervisor_email?: string;
  expected_completion?: string;
  notes?: string;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const s = iso.includes("T") || iso.includes("Z") ? iso : iso.replace(" ", "T") + "Z";
  return new Date(s).toLocaleString(undefined, {
    year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

function parseAppData(raw: string | null): ApplicationData | null {
  if (!raw) return null;
  try { return JSON.parse(raw) as ApplicationData; }
  catch { return null; }
}

export default function DiscountQueuePage() {
  const [rows, setRows] = useState<PendingRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [decidingId, setDecidingId] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ id: number; type: "ok" | "err"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/discounts/pending");
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Failed to load pending discounts.");
        return;
      }
      setRows(body.pending as PendingRow[]);
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleDecision = useCallback(
    async (id: number, action: "approve" | "deny", reason?: string, expiresAt?: string) => {
      setDecidingId(id);
      setMsg(null);
      try {
        const res = await fetch(`/api/admin/discounts/${id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, reason, expires_at: expiresAt }),
        });
        const body = await res.json();
        if (!res.ok) {
          setMsg({ id, type: "err", text: body.error ?? "Decision failed." });
          return;
        }
        setMsg({ id, type: "ok", text: body.message ?? "Decision recorded." });
        void load();
      } catch {
        setMsg({ id, type: "err", text: "Network error." });
      } finally {
        setDecidingId(null);
      }
    },
    [load],
  );

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1" style={{ color: "#1e4d8c" }}>Discount Queue</h1>
      <p className="text-sm text-gray-500 mb-6">
        Student / resident discount applications awaiting verification.
        Auto-verified school-email signups (.edu, .ac.*, etc.) skip this queue.
      </p>

      {loading && <div className="text-gray-500 text-center py-12">Loading…</div>}

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 text-red-800 text-sm p-3 mb-4">
          {error}
        </div>
      )}

      {!loading && !error && rows && rows.length === 0 && (
        <div className="rounded-md border border-dashed border-gray-300 text-gray-500 text-sm text-center py-10">
          No pending discount applications. 🎉
        </div>
      )}

      {!loading && !error && rows && rows.length > 0 && (
        <div className="space-y-4">
          {rows.map((r) => (
            <PendingCard
              key={r.id}
              row={r}
              deciding={decidingId === r.id}
              msg={msg && msg.id === r.id ? msg : null}
              onDecide={(action, reason, expiresAt) => handleDecision(r.id, action, reason, expiresAt)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PendingCard({
  row, deciding, msg, onDecide,
}: {
  row: PendingRow;
  deciding: boolean;
  msg: { type: "ok" | "err"; text: string } | null;
  onDecide: (action: "approve" | "deny", reason?: string, expiresAt?: string) => void;
}) {
  const [denyReason, setDenyReason] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [mode, setMode] = useState<null | "approve" | "deny">(null);
  const app = parseAppData(row.application_data);

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5">
      <div className="flex items-baseline justify-between gap-3 flex-wrap mb-3">
        <div>
          <h3 className="text-base font-bold" style={{ color: "#1e4d8c" }}>
            {row.full_name || row.username}{" "}
            <span className="text-xs font-medium text-gray-500">({row.email})</span>
          </h3>
          <p className="text-xs text-gray-500">
            Type: <span className="font-semibold capitalize">{row.discount_type}</span> · Submitted {fmtDate(row.created_at)}
          </p>
        </div>
        <span className="inline-block rounded bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
          Pending review
        </span>
      </div>

      {app && (
        <dl className="grid grid-cols-[170px_1fr] gap-x-3 gap-y-1 text-xs text-gray-700 mb-4">
          <dt className="text-gray-500">Institution</dt>
          <dd>{app.institution_name ?? "—"}</dd>
          <dt className="text-gray-500">Program</dt>
          <dd>{app.program_name ?? "—"}</dd>
          <dt className="text-gray-500">Supervisor</dt>
          <dd>{app.supervisor_name ?? "—"} <span className="text-gray-500">· {app.supervisor_email ?? "—"}</span></dd>
          <dt className="text-gray-500">Expected completion</dt>
          <dd>{app.expected_completion ?? "—"}</dd>
          {app.notes && (
            <>
              <dt className="text-gray-500">Notes</dt>
              <dd className="whitespace-pre-wrap">{app.notes}</dd>
            </>
          )}
        </dl>
      )}

      {mode === null && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={deciding}
            onClick={() => setMode("approve")}
            className="rounded px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
            style={{ background: "#047857" }}
          >
            ✓ Approve
          </button>
          <button
            type="button"
            disabled={deciding}
            onClick={() => setMode("deny")}
            className="rounded border px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
            style={{ borderColor: "#dc2626", color: "#dc2626" }}
          >
            ✗ Deny
          </button>
          {app?.supervisor_email && (
            <a
              href={`mailto:${app.supervisor_email}?subject=Verifying%20${row.full_name || row.username}%27s%20training%20status%20%E2%80%94%20Vancomyzer%20discount&body=Hi%20${encodeURIComponent(app.supervisor_name ?? "")},%0A%0AWe%27re%20reviewing%20a%20discount%20application%20from%20${encodeURIComponent(row.full_name || row.username)}%20(${encodeURIComponent(row.email)})%20who%20listed%20you%20as%20their%20supervisor.%20Could%20you%20confirm%20they%27re%20currently%20in%20training%20at%20${encodeURIComponent(app.institution_name ?? "")}%3F%0A%0AThanks,%0AVancomyzer`}
              className="text-xs text-blue-700 hover:underline ml-2"
            >
              Email supervisor →
            </a>
          )}
        </div>
      )}

      {mode === "approve" && (
        <div className="rounded border border-emerald-200 bg-emerald-50 p-3">
          <div className="text-xs font-semibold text-emerald-900 mb-2">Approve discount</div>
          <label className="block text-xs text-gray-700 mb-1">
            Expires at (optional, ISO date — defaults to no expiry)
          </label>
          <input
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className="text-xs rounded border border-gray-300 px-2 py-1 mb-3"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={deciding}
              onClick={() => onDecide("approve", undefined, expiresAt || undefined)}
              className="rounded px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
              style={{ background: "#047857" }}
            >
              {deciding ? "Approving…" : "Confirm approve"}
            </button>
            <button
              type="button"
              disabled={deciding}
              onClick={() => setMode(null)}
              className="rounded border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {mode === "deny" && (
        <div className="rounded border border-red-200 bg-red-50 p-3">
          <div className="text-xs font-semibold text-red-900 mb-2">Deny discount</div>
          <label className="block text-xs text-gray-700 mb-1">Reason (emailed to applicant)</label>
          <textarea
            value={denyReason}
            onChange={(e) => setDenyReason(e.target.value)}
            rows={2}
            placeholder="e.g., Unable to verify training status from the institution provided."
            className="w-full text-xs rounded border border-gray-300 px-2 py-1 mb-3"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={deciding}
              onClick={() => onDecide("deny", denyReason)}
              className="rounded px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
              style={{ background: "#dc2626" }}
            >
              {deciding ? "Denying…" : "Confirm deny"}
            </button>
            <button
              type="button"
              disabled={deciding}
              onClick={() => setMode(null)}
              className="rounded border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {msg && (
        <p className={`mt-2 text-xs ${msg.type === "ok" ? "text-green-700" : "text-red-700"}`}>{msg.text}</p>
      )}
    </div>
  );
}
