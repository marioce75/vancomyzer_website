"use client";

/**
 * Student / resident discount card — shown on /settings.
 *
 * Four states:
 *   - no discount: show "Apply for student/resident discount" CTA + form
 *   - pending:     show "Application under review" status
 *   - approved / auto_verified: show "Discount active" badge + reminder
 *                  that it auto-applies at Pro checkout
 *   - denied:      show the denial reason + invitation to re-apply
 */

import { useEffect, useState } from "react";

interface DiscountRow {
  id: number;
  user_id: number;
  discount_type: "student" | "resident";
  status: "auto_verified" | "pending" | "approved" | "denied";
  application_data: string | null;
  verified_at: string | null;
  verified_by: string | null;
  denied_reason: string | null;
  expires_at: string | null;
  created_at: string;
}

export default function DiscountStatusCard() {
  const [discount, setDiscount] = useState<DiscountRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/discounts/me");
      if (res.ok) {
        const data = await res.json();
        setDiscount(data.discount);
      }
    } catch {/* ignore */}
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  if (loading) return null;

  // ─── ACTIVE DISCOUNT ─────────────────────────────────────────────
  if (discount && (discount.status === "auto_verified" || discount.status === "approved")) {
    const label = discount.discount_type === "student" ? "Student" : "Resident";
    const verifiedNote = discount.status === "auto_verified"
      ? "Auto-verified via your academic email domain"
      : `Approved ${discount.verified_at?.slice(0, 10) ?? ""}`;
    return (
      <section style={{ ...cardStyle, borderLeft: "4px solid #047857" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, marginBottom: 6 }}>
          <h2 style={titleStyle}>{label} discount active 🎓</h2>
          <span style={{ ...badgeStyle, background: "#ecfdf5", color: "#047857", border: "1px solid #6ee7b7" }}>
            ✓ Verified
          </span>
        </header>
        <p style={{ fontSize: 12, color: "var(--color-secondary)", lineHeight: 1.55, margin: 0 }}>
          {verifiedNote}. Your discount auto-applies at Pro checkout — the reduced price appears on your Stripe receipt automatically.
        </p>
        {discount.expires_at && (
          <p style={{ fontSize: 11, color: "var(--color-dim)", marginTop: 6, marginBottom: 0 }}>
            Expires {new Date(discount.expires_at).toLocaleDateString()}.
          </p>
        )}
      </section>
    );
  }

  // ─── PENDING ─────────────────────────────────────────────────────
  if (discount?.status === "pending") {
    return (
      <section style={{ ...cardStyle, borderLeft: "4px solid #d97706" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, marginBottom: 6 }}>
          <h2 style={titleStyle}>{discount.discount_type === "student" ? "Student" : "Resident"} discount — under review</h2>
          <span style={{ ...badgeStyle, background: "#fffbeb", color: "#92400e", border: "1px solid #fcd34d" }}>
            ⏳ Pending
          </span>
        </header>
        <p style={{ fontSize: 12, color: "var(--color-secondary)", lineHeight: 1.55, margin: 0 }}>
          Submitted {discount.created_at?.slice(0, 10)}. We&apos;ll email you within 1-2 business days with the decision.
        </p>
      </section>
    );
  }

  // ─── DENIED ──────────────────────────────────────────────────────
  if (discount?.status === "denied") {
    return (
      <section style={{ ...cardStyle, borderLeft: "4px solid #dc2626" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, marginBottom: 6 }}>
          <h2 style={titleStyle}>Discount application — additional info needed</h2>
          <span style={{ ...badgeStyle, background: "#fef2f2", color: "#991b1b", border: "1px solid #fca5a5" }}>
            Not approved
          </span>
        </header>
        <p style={{ fontSize: 12, color: "var(--color-secondary)", lineHeight: 1.55, margin: "0 0 8px 0" }}>
          {discount.denied_reason ?? "Application did not meet verification criteria."}
        </p>
        <button
          type="button"
          onClick={() => setShowForm(true)}
          style={primaryBtnStyle}
        >
          Re-apply
        </button>
        {showForm && <ApplicationForm onSubmitted={() => { setShowForm(false); void load(); }} />}
      </section>
    );
  }

  // ─── NO DISCOUNT YET — show CTA ──────────────────────────────────
  return (
    <section style={cardStyle}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, marginBottom: 6 }}>
        <h2 style={titleStyle}>Student or resident? Apply for a discount</h2>
      </header>
      <p style={{ fontSize: 12, color: "var(--color-secondary)", lineHeight: 1.55, margin: "0 0 10px 0" }}>
        Vancomyzer offers reduced pricing for pharmacy students, medical students, and residents in training. Submit a short application and we&apos;ll verify your training status within 1-2 business days.
      </p>
      {!showForm ? (
        <button type="button" onClick={() => setShowForm(true)} style={primaryBtnStyle}>
          Apply for discount
        </button>
      ) : (
        <ApplicationForm onSubmitted={() => { setShowForm(false); void load(); }} />
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────

function ApplicationForm({ onSubmitted }: { onSubmitted: () => void }) {
  const [type, setType] = useState<"student" | "resident">("student");
  const [institution, setInstitution] = useState("");
  const [program, setProgram] = useState("");
  const [supervisorName, setSupervisorName] = useState("");
  const [supervisorEmail, setSupervisorEmail] = useState("");
  const [expected, setExpected] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMsg(null);
    try {
      const res = await fetch("/api/discounts/me", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          discount_type: type,
          institution_name: institution,
          program_name: program,
          supervisor_name: supervisorName,
          supervisor_email: supervisorEmail,
          expected_completion: expected,
          notes,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setMsg({ type: "err", text: body.error ?? "Submission failed." });
        return;
      }
      setMsg({ type: "ok", text: body.message ?? "Application submitted." });
      setTimeout(onSubmitted, 1500);
    } catch {
      setMsg({ type: "err", text: "Network error." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: 12, padding: 14, background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: 4 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <label style={labelStyle}>Discount type *</label>
          <select value={type} onChange={(e) => setType(e.target.value as "student" | "resident")} required style={inputStyle}>
            <option value="student">Student (pharmacy / medical / nursing)</option>
            <option value="resident">Resident / fellow</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Expected completion *</label>
          <input type="text" value={expected} onChange={(e) => setExpected(e.target.value)} placeholder="e.g., June 2027" required style={inputStyle} />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={labelStyle}>Institution / school *</label>
          <input type="text" value={institution} onChange={(e) => setInstitution(e.target.value)} placeholder="e.g., UCSF School of Pharmacy" required style={inputStyle} />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={labelStyle}>Program *</label>
          <input type="text" value={program} onChange={(e) => setProgram(e.target.value)} placeholder="e.g., PharmD class of 2027, or PGY-2 Infectious Diseases Residency" required style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Supervisor / preceptor name *</label>
          <input type="text" value={supervisorName} onChange={(e) => setSupervisorName(e.target.value)} placeholder="Dr. Jane Doe" required style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Supervisor email *</label>
          <input type="email" value={supervisorEmail} onChange={(e) => setSupervisorEmail(e.target.value)} placeholder="jdoe@ucsf.edu" required style={inputStyle} />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={labelStyle}>Notes (optional)</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything else we should know (e.g., 'I started PGY-1 last week, no badge yet')" rows={2} style={{ ...inputStyle, fontFamily: "inherit", resize: "vertical" as const }} />
        </div>
      </div>
      <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <button type="submit" disabled={submitting} style={{
          ...primaryBtnStyle,
          background: submitting ? "var(--color-border)" : "var(--color-primary)",
          cursor: submitting ? "wait" : "pointer",
        }}>
          {submitting ? "Submitting…" : "Submit application"}
        </button>
        {msg && (
          <span style={{ fontSize: 12, color: msg.type === "ok" ? "#047857" : "#b91c1c" }}>
            {msg.text}
          </span>
        )}
      </div>
      <p style={{ fontSize: 11, color: "var(--color-dim)", marginTop: 8, marginBottom: 0, lineHeight: 1.55 }}>
        We may contact your supervisor to confirm. Discount auto-expires when training ends — let us know if your training status changes.
      </p>
    </form>
  );
}

const cardStyle: React.CSSProperties = {
  padding: 16,
  marginBottom: 24,
  background: "var(--color-card)",
  border: "1px solid var(--color-border)",
  borderRadius: 6,
};
const titleStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  color: "var(--color-primary)",
  margin: 0,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
};
const badgeStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "2px 10px",
  fontSize: 11,
  fontWeight: 600,
  borderRadius: 4,
};
const primaryBtnStyle: React.CSSProperties = {
  padding: "8px 16px",
  fontSize: 13,
  fontWeight: 600,
  background: "var(--color-primary)",
  color: "#ffffff",
  border: "none",
  borderRadius: 4,
  cursor: "pointer",
};
const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  color: "var(--color-secondary)",
  marginBottom: 4,
  fontWeight: 600,
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
