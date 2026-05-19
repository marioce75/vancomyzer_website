"use client";

import { useEffect, useState, useCallback, Fragment } from "react";

interface BaaStatus {
  status: "not_requested" | "pending" | "active";
  submitted_at: string | null;
  executed_at: string | null;
  signer: { name: string; title: string; email: string } | null;
  template_version: string | null;
  template_approved: boolean;
  download_available: boolean;
  executed_pdf_available: boolean;
}

interface BaaCardProps {
  institutionName: string;
  fallbackSignerEmail?: string;
  /** Called whenever the BAA status changes (upload, countersign). Parent uses this to refresh banner state. */
  onStatusChange?: (status: BaaStatus) => void;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    const s = iso.includes("T") || iso.includes("Z") ? iso : iso.replace(" ", "T") + "Z";
    return new Date(s).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function BaaCard({ institutionName, fallbackSignerEmail, onStatusChange }: BaaCardProps) {
  const [status, setStatus] = useState<BaaStatus | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // upload form state
  const [signerName, setSignerName] = useState("");
  const [signerTitle, setSignerTitle] = useState("");
  const [signerEmail, setSignerEmail] = useState(fallbackSignerEmail ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/billing/baa/status");
      const body = await res.json();
      if (!res.ok) {
        setLoadError(body.error ?? "Could not load BAA status.");
        return;
      }
      setStatus(body as BaaStatus);
      if (onStatusChange) onStatusChange(body as BaaStatus);
    } catch {
      setLoadError("Network error loading BAA status.");
    } finally {
      setLoading(false);
    }
  }, [onStatusChange]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const handleDownload = useCallback(async () => {
    try {
      const res = await fetch("/api/billing/baa/download");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        alert(body.error ?? "Download failed.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Vancomyzer-BAA-${institutionName.replace(/[^A-Za-z0-9_-]+/g, "_")}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Network error during download.");
    }
  }, [institutionName]);

  const handleUpload = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!file) {
        setUploadMsg({ type: "err", text: "Select a signed PDF first." });
        return;
      }
      if (!signerName || !signerTitle) {
        setUploadMsg({ type: "err", text: "Signer name and title are required." });
        return;
      }
      setUploading(true);
      setUploadMsg(null);
      try {
        const form = new FormData();
        form.set("file", file);
        form.set("signer_name", signerName);
        form.set("signer_title", signerTitle);
        if (signerEmail) form.set("signer_email", signerEmail);
        form.set("template_version", status?.template_version ?? "unknown");
        const res = await fetch("/api/billing/baa/upload", { method: "POST", body: form });
        const body = await res.json();
        if (!res.ok) {
          setUploadMsg({ type: "err", text: body.error ?? "Upload failed." });
          return;
        }
        setUploadMsg({ type: "ok", text: body.next_step ?? "BAA submitted." });
        setFile(null);
        setSignerName("");
        setSignerTitle("");
        void loadStatus();
      } catch {
        setUploadMsg({ type: "err", text: "Network error during upload." });
      } finally {
        setUploading(false);
      }
    },
    [file, signerName, signerTitle, signerEmail, status, loadStatus],
  );

  if (loading) {
    return (
      <section style={cardWrap}>
        <div style={{ padding: 20, color: "var(--color-dim)", fontSize: 13 }}>Loading BAA status…</div>
      </section>
    );
  }

  if (loadError) {
    return (
      <section style={cardWrap}>
        <div style={{ padding: 16, color: "#991b1b", background: "#fff5f5", border: "1px solid #fca5a5", borderRadius: 4, fontSize: 13 }}>
          {loadError}
        </div>
      </section>
    );
  }

  if (!status) return null;

  return (
    <section style={cardWrap}>
      <header style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
        <h2 style={{ fontSize: 13, fontWeight: 700, color: "var(--color-primary)", letterSpacing: "0.06em", textTransform: "uppercase", margin: 0 }}>
          Business Associate Agreement
        </h2>
        <StatusBadge status={status.status} />
      </header>

      {status.status === "not_requested" && (
        <NotRequestedView
          downloadAvailable={status.download_available}
          templateApproved={status.template_approved}
          onDownload={handleDownload}
          uploadProps={{
            signerName, setSignerName,
            signerTitle, setSignerTitle,
            signerEmail, setSignerEmail,
            file, setFile,
            uploading, uploadMsg,
            onSubmit: handleUpload,
          }}
        />
      )}

      {status.status === "pending" && (
        <PendingView
          submittedAt={status.submitted_at}
          signer={status.signer}
          templateVersion={status.template_version}
        />
      )}

      {status.status === "active" && (
        <ActiveView
          executedAt={status.executed_at}
          signer={status.signer}
          templateVersion={status.template_version}
          executedPdfAvailable={status.executed_pdf_available}
        />
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Sub-views
// ─────────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: BaaStatus["status"] }) {
  const styles: Record<BaaStatus["status"], { bg: string; fg: string; border: string; label: string }> = {
    not_requested: { bg: "#fef3c7", fg: "#92400e", border: "#fcd34d", label: "Action required" },
    pending: { bg: "#dbeafe", fg: "#1e3a8a", border: "#93c5fd", label: "Awaiting countersign" },
    active: { bg: "#ecfdf5", fg: "#047857", border: "#6ee7b7", label: "✓ Executed" },
  };
  const s = styles[status];
  return (
    <span style={{ display: "inline-block", padding: "2px 10px", fontSize: 11, fontWeight: 600, background: s.bg, color: s.fg, border: `1px solid ${s.border}`, borderRadius: 4 }}>
      {s.label}
    </span>
  );
}

interface UploadFormProps {
  signerName: string;
  setSignerName: (s: string) => void;
  signerTitle: string;
  setSignerTitle: (s: string) => void;
  signerEmail: string;
  setSignerEmail: (s: string) => void;
  file: File | null;
  setFile: (f: File | null) => void;
  uploading: boolean;
  uploadMsg: { type: "ok" | "err"; text: string } | null;
  onSubmit: (e: React.FormEvent) => void;
}

function NotRequestedView({
  downloadAvailable, templateApproved, onDownload, uploadProps,
}: {
  downloadAvailable: boolean;
  templateApproved: boolean;
  onDownload: () => void;
  uploadProps: UploadFormProps;
}) {
  return (
    <div>
      <p style={{ fontSize: 13, color: "var(--color-secondary)", lineHeight: 1.55, marginTop: 0 }}>
        Your team can use Vancomyzer freely without a BAA — the calculator does not persist patient identifiers.
        A signed BAA is required only when your institution&apos;s legal or compliance team requires one on file
        before any PHI may be entered into a third-party SaaS tool.
      </p>

      <div style={{ marginTop: 14, marginBottom: 14, padding: "12px 14px", background: "#f7fafc", border: "1px solid var(--color-border)", borderRadius: 4 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--color-primary)", marginBottom: 6 }}>Step 1 — Download our BAA template</div>
        {downloadAvailable ? (
          <button
            type="button"
            onClick={onDownload}
            style={{
              padding: "8px 14px",
              fontSize: 12,
              fontWeight: 600,
              background: "var(--color-primary)",
              color: "#ffffff",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            Download BAA template (PDF) ↓
          </button>
        ) : (
          <div style={{ fontSize: 12, color: "#92400e", background: "#fffbeb", padding: "8px 10px", border: "1px solid #fcd34d", borderRadius: 4 }}>
            The self-serve BAA template is under attorney review and not yet available for download.
            Please email <a href="mailto:contact@dosys.health" style={{ color: "var(--color-primary)" }}>contact@dosys.health</a>{" "}
            to receive the BAA manually while we finalize the self-serve flow.
          </div>
        )}
        {!templateApproved && downloadAvailable && (
          <div style={{ marginTop: 8, fontSize: 11, color: "#92400e" }}>
            (Superadmin preview — template is DRAFT, not approved for customer signing.)
          </div>
        )}
      </div>

      <div style={{ marginBottom: 14, padding: "12px 14px", background: "#f7fafc", border: "1px solid var(--color-border)", borderRadius: 4 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--color-primary)", marginBottom: 4 }}>Step 2 — Sign and return</div>
        <p style={{ fontSize: 12, color: "var(--color-secondary)", margin: 0, lineHeight: 1.55 }}>
          Have an authorized officer of your institution sign the BAA (DocuSign, wet-ink + scan, or your preferred
          tool). Upload the signed PDF below. Dōsys Health LLC will countersign within one business day and email
          you the fully-executed copy.
        </p>
      </div>

      <UploadForm {...uploadProps} disabled={!downloadAvailable} />
    </div>
  );
}

function UploadForm(props: UploadFormProps & { disabled: boolean }) {
  const { signerName, setSignerName, signerTitle, setSignerTitle, signerEmail, setSignerEmail,
    file, setFile, uploading, uploadMsg, onSubmit, disabled } = props;
  return (
    <form onSubmit={onSubmit} style={{ padding: "14px", background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: 4 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--color-primary)", marginBottom: 10 }}>Step 3 — Upload your signed BAA</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <label style={labelStyle}>Signer full name *</label>
          <input
            type="text"
            value={signerName}
            onChange={(e) => setSignerName(e.target.value)}
            disabled={disabled || uploading}
            placeholder="Jane Doe, PharmD"
            required
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Signer title *</label>
          <input
            type="text"
            value={signerTitle}
            onChange={(e) => setSignerTitle(e.target.value)}
            disabled={disabled || uploading}
            placeholder="Director of Pharmacy"
            required
            style={inputStyle}
          />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={labelStyle}>Signer email (optional — receives the executed copy)</label>
          <input
            type="email"
            value={signerEmail}
            onChange={(e) => setSignerEmail(e.target.value)}
            disabled={disabled || uploading}
            placeholder="defaults to your admin email"
            style={inputStyle}
          />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={labelStyle}>Signed BAA PDF *</label>
          <input
            type="file"
            accept="application/pdf,.pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            disabled={disabled || uploading}
            required
            style={{ fontSize: 12 }}
          />
          {file && (
            <div style={{ fontSize: 11, color: "var(--color-dim)", marginTop: 4 }}>
              Selected: {file.name} ({Math.round(file.size / 1024)} KB)
            </div>
          )}
        </div>
      </div>
      <div style={{ marginTop: 14, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button
          type="submit"
          disabled={disabled || uploading || !file}
          style={{
            padding: "9px 16px",
            fontSize: 13,
            fontWeight: 600,
            background: disabled || uploading || !file ? "var(--color-border)" : "var(--color-primary)",
            color: "#ffffff",
            border: "none",
            borderRadius: 4,
            cursor: disabled || uploading || !file ? "not-allowed" : "pointer",
          }}
        >
          {uploading ? "Uploading…" : "Submit signed BAA"}
        </button>
        {uploadMsg && (
          <span style={{ fontSize: 12, color: uploadMsg.type === "ok" ? "#047857" : "#b91c1c", lineHeight: 1.5 }}>
            {uploadMsg.text}
          </span>
        )}
      </div>
    </form>
  );
}

function PendingView({
  submittedAt, signer, templateVersion,
}: {
  submittedAt: string | null;
  signer: BaaStatus["signer"];
  templateVersion: string | null;
}) {
  return (
    <div>
      <p style={{ fontSize: 13, color: "var(--color-secondary)", lineHeight: 1.55, marginTop: 0 }}>
        Your signed BAA was received on <strong>{fmtDate(submittedAt)}</strong>. Dōsys Health LLC will countersign
        within one business day and email the fully-executed copy to your signer. No further action required from you.
      </p>
      <KeyValueGrid
        items={[
          ["Signer", signer ? `${signer.name} · ${signer.title}` : "—"],
          ["Signer email", signer?.email ?? "—"],
          ["Template version", templateVersion ?? "—"],
          ["Submitted", fmtDate(submittedAt)],
        ]}
      />
    </div>
  );
}

function ActiveView({
  executedAt, signer, templateVersion, executedPdfAvailable,
}: {
  executedAt: string | null;
  signer: BaaStatus["signer"];
  templateVersion: string | null;
  executedPdfAvailable: boolean;
}) {
  return (
    <div>
      <p style={{ fontSize: 13, color: "var(--color-secondary)", lineHeight: 1.55, marginTop: 0 }}>
        Your BAA with Dōsys Health LLC is fully executed as of <strong>{fmtDate(executedAt)}</strong>. A copy was
        emailed to your signer. {executedPdfAvailable ? "You can also download the executed PDF below." : ""}
      </p>
      <KeyValueGrid
        items={[
          ["Signer", signer ? `${signer.name} · ${signer.title}` : "—"],
          ["Signer email", signer?.email ?? "—"],
          ["Template version", templateVersion ?? "—"],
          ["Executed", fmtDate(executedAt)],
        ]}
      />
      {executedPdfAvailable && (
        <a
          href="/api/billing/baa/executed-pdf"
          download
          style={{
            display: "inline-block",
            marginTop: 12,
            padding: "8px 14px",
            fontSize: 12,
            fontWeight: 600,
            background: "transparent",
            color: "var(--color-primary)",
            border: "1px solid var(--color-border)",
            borderRadius: 4,
            textDecoration: "none",
          }}
        >
          Download executed BAA ↓
        </a>
      )}
    </div>
  );
}

function KeyValueGrid({ items }: { items: [string, string][] }) {
  return (
    <dl style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: "6px 12px", fontSize: 12, marginTop: 12, marginBottom: 0 }}>
      {items.map(([k, v]) => (
        <Fragment key={k}>
          <dt style={{ color: "var(--color-dim)", margin: 0 }}>{k}</dt>
          <dd style={{ color: "var(--color-primary)", margin: 0 }}>{v}</dd>
        </Fragment>
      ))}
    </dl>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────

const cardWrap: React.CSSProperties = {
  padding: 16,
  marginBottom: 24,
  background: "var(--color-card)",
  border: "1px solid var(--color-border)",
  borderRadius: 6,
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  color: "var(--color-secondary)",
  marginBottom: 4,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  fontSize: 13,
  border: "1px solid var(--color-border)",
  background: "var(--color-card)",
  color: "var(--color-primary)",
  borderRadius: 4,
  boxSizing: "border-box",
};
