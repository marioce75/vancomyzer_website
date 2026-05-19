"use client";

/**
 * Superadmin BAA queue — institutions whose signed BAA is awaiting
 * Dōsys countersign. For each pending institution, lets Mario:
 *  - download the customer-submitted PDF
 *  - upload a countersigned PDF + flip status to 'active'
 *
 * Auth is enforced server-side by /api/admin/baa/* (system role='admin').
 */

import { useCallback, useEffect, useState } from "react";

interface PendingRow {
  id: number;
  institution_name: string;
  billing_email: string;
  plan_tier: string;
  signer_name: string | null;
  signer_title: string | null;
  signer_email: string | null;
  submitted_at: string | null;
  template_version: string | null;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const s = iso.includes("T") || iso.includes("Z") ? iso : iso.replace(" ", "T") + "Z";
  return new Date(s).toLocaleString(undefined, {
    year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

export default function BaaQueuePage() {
  const [rows, setRows] = useState<PendingRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ id: number; type: "ok" | "err"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/baa/pending");
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Failed to load pending BAAs.");
        return;
      }
      setRows(body.pending as PendingRow[]);
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCountersign = useCallback(
    async (id: number, file: File | null) => {
      if (!file) {
        setMsg({ id, type: "err", text: "Pick the countersigned PDF first." });
        return;
      }
      setUploadingId(id);
      setMsg(null);
      try {
        const form = new FormData();
        form.set("file", file);
        const res = await fetch(`/api/admin/baa/${id}/countersign`, {
          method: "POST",
          body: form,
        });
        const body = await res.json();
        if (!res.ok) {
          setMsg({ id, type: "err", text: body.error ?? "Countersign failed." });
          return;
        }
        setMsg({ id, type: "ok", text: "BAA fully executed. Customer notified by email." });
        void load();
      } catch {
        setMsg({ id, type: "err", text: "Network error." });
      } finally {
        setUploadingId(null);
      }
    },
    [load],
  );

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1" style={{ color: "#1e4d8c" }}>BAA Queue</h1>
      <p className="text-sm text-gray-500 mb-6">
        Institutions awaiting Dōsys Health LLC countersign on their submitted Business Associate Agreement.
      </p>

      {loading && <div className="text-gray-500 text-center py-12">Loading…</div>}

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 text-red-800 text-sm p-3 mb-4">
          {error}
        </div>
      )}

      {!loading && !error && rows && rows.length === 0 && (
        <div className="rounded-md border border-dashed border-gray-300 text-gray-500 text-sm text-center py-10">
          No BAAs awaiting countersign. 🎉
        </div>
      )}

      {!loading && !error && rows && rows.length > 0 && (
        <div className="space-y-4">
          {rows.map((r) => (
            <PendingCard
              key={r.id}
              row={r}
              uploading={uploadingId === r.id}
              msg={msg && msg.id === r.id ? msg : null}
              onCountersign={(file) => handleCountersign(r.id, file)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PendingCard({
  row, uploading, msg, onCountersign,
}: {
  row: PendingRow;
  uploading: boolean;
  msg: { type: "ok" | "err"; text: string } | null;
  onCountersign: (file: File | null) => void;
}) {
  const [file, setFile] = useState<File | null>(null);

  return (
    <div
      id={`baa-${row.id}`}
      className="bg-white border border-gray-200 rounded-lg p-5"
    >
      <div className="flex items-baseline justify-between gap-3 flex-wrap mb-3">
        <div>
          <h3 className="text-base font-bold" style={{ color: "#1e4d8c" }}>{row.institution_name}</h3>
          <p className="text-xs text-gray-500">
            Plan: <span className="font-semibold">{row.plan_tier}</span> · Billing: {row.billing_email}
          </p>
        </div>
        <span className="inline-block rounded bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800">
          Awaiting countersign
        </span>
      </div>

      <dl className="grid grid-cols-[160px_1fr] gap-x-3 gap-y-1 text-xs text-gray-700 mb-4">
        <dt className="text-gray-500">Signer</dt>
        <dd>{row.signer_name ?? "—"} <span className="text-gray-500">· {row.signer_title ?? "—"}</span></dd>
        <dt className="text-gray-500">Signer email</dt>
        <dd>{row.signer_email ?? "—"}</dd>
        <dt className="text-gray-500">Template version</dt>
        <dd>{row.template_version ?? "—"}</dd>
        <dt className="text-gray-500">Submitted</dt>
        <dd>{fmtDate(row.submitted_at)}</dd>
      </dl>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <a
          href={`/api/admin/baa/${row.id}/countersign`}
          className="inline-block rounded border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
          download
        >
          Download customer-signed PDF ↓
        </a>
        <span className="text-xs text-gray-500">
          Countersign it externally, then upload the fully-executed PDF below.
        </span>
      </div>

      <div className="rounded border border-gray-200 bg-gray-50 p-3">
        <div className="text-xs font-semibold text-gray-700 mb-2">Upload countersigned PDF</div>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="file"
            accept="application/pdf,.pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            disabled={uploading}
            className="text-xs"
          />
          <button
            type="button"
            disabled={uploading || !file}
            onClick={() => onCountersign(file)}
            className="rounded px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
            style={{ background: uploading || !file ? "#94a3b8" : "#1e4d8c" }}
          >
            {uploading ? "Uploading…" : "Countersign & notify customer"}
          </button>
        </div>
        {msg && (
          <p className={`mt-2 text-xs ${msg.type === "ok" ? "text-green-700" : "text-red-700"}`}>{msg.text}</p>
        )}
      </div>
    </div>
  );
}
