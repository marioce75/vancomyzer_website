"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";

interface MemberRow {
  id: number;
  username: string;
  email: string;
  full_name: string;
  credentials: string;
  status: string;
  institutional_role: "user" | "admin";
  last_login: string | null;
  created_at: string;
}

interface MembersResponse {
  members: MemberRow[];
  seats_used: number;
  seats_allocated: number;
  institution_name: string;
}

interface AuditRow {
  id: number;
  calculated_at: string;
  user_id: number;
  username: string | null;
  full_name: string | null;
  workflow_type: string;
  pk_model: string;
  dose_mg: number | null;
  interval_hours: number | null;
  auc24: number | null;
  peak: number | null;
  trough: number | null;
  auc_in_range: number;
  case_id: string | null;
}

interface AuditResponse {
  rows: AuditRow[];
  institution_name: string;
}

function fmtDate(iso: string): string {
  try {
    const s = iso.includes("T") || iso.includes("Z") ? iso : iso.replace(" ", "T") + "Z";
    return new Date(s).toLocaleString(undefined, {
      year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function workflowLabel(t: string): string {
  if (t === "empiric") return "Initial regimen";
  if (t === "existing") return "Adjustment";
  return t;
}

export default function TeamPage() {
  const { user, loading: authLoading } = useAuth();
  const [members, setMembers] = useState<MemberRow[] | null>(null);
  const [seats, setSeats] = useState<{ used: number; allocated: number } | null>(null);
  const [institutionName, setInstitutionName] = useState<string>("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteCreds, setInviteCreds] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const [audit, setAudit] = useState<AuditRow[] | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [showAudit, setShowAudit] = useState(false);

  const loadMembers = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/team/members");
      const body = await res.json();
      if (!res.ok) {
        setLoadError(body.error ?? "Failed to load team.");
        setMembers(null);
        return;
      }
      const data = body as MembersResponse;
      setMembers(data.members);
      setSeats({ used: data.seats_used, allocated: data.seats_allocated });
      setInstitutionName(data.institution_name);
    } catch {
      setLoadError("Network error.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAudit = useCallback(async () => {
    setAuditLoading(true);
    try {
      const res = await fetch("/api/team/audit?limit=100");
      const body = await res.json();
      if (res.ok) {
        const data = body as AuditResponse;
        setAudit(data.rows);
      }
    } finally {
      setAuditLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    void loadMembers();
  }, [user, loadMembers]);

  useEffect(() => {
    if (showAudit && audit === null) void loadAudit();
  }, [showAudit, audit, loadAudit]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviting(true);
    setInviteMsg(null);
    try {
      const res = await fetch("/api/team/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail,
          full_name: inviteName,
          credentials: inviteCreds,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setInviteMsg({ type: "err", text: body.error ?? "Invite failed." });
        return;
      }
      setInviteMsg({
        type: "ok",
        text: `Invited ${inviteEmail}. Sign-in link sent to their inbox.`,
      });
      setInviteEmail("");
      setInviteName("");
      setInviteCreds("");
      void loadMembers();
    } catch {
      setInviteMsg({ type: "err", text: "Network error." });
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = async (id: number, email: string) => {
    if (!confirm(`Remove ${email} from your team? They lose institution access immediately.`)) return;
    const res = await fetch(`/api/team/members/${id}`, { method: "DELETE" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(body.error ?? "Remove failed.");
      return;
    }
    void loadMembers();
  };

  const handleRoleToggle = async (id: number, currentRole: "user" | "admin") => {
    const newRole = currentRole === "admin" ? "user" : "admin";
    const res = await fetch(`/api/team/members/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ institutional_role: newRole }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(body.error ?? "Role change failed.");
      return;
    }
    void loadMembers();
  };

  if (authLoading) {
    return <div style={{ padding: 40, textAlign: "center", color: "var(--color-dim)" }}>Loading...</div>;
  }
  if (!user) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <p style={{ color: "var(--color-secondary)" }}>
          Please <Link href="/login" style={{ color: "var(--color-primary)" }}>sign in</Link> to manage your team.
        </p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 16px 80px" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--color-primary)", marginBottom: 8 }}>
          Team Management
        </h1>
        <div style={{
          padding: "14px 16px",
          background: "#fff5f5",
          border: "1px solid #fca5a5",
          color: "#991b1b",
          fontSize: 13,
          borderRadius: 4,
          marginBottom: 16,
        }}>
          {loadError}
        </div>
        <p style={{ fontSize: 13, color: "var(--color-secondary)", lineHeight: 1.6 }}>
          Team management is available on Department and Hospital plans, and only to users
          designated as institutional admins. If your team needs this feature, see{" "}
          <a
            href="https://dosys.health/pricing"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--color-primary)", textDecoration: "underline" }}
          >
            Department &amp; Hospital plans
          </a>{" "}
          on dosys.health.
        </p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px 16px 80px" }}>
      <div style={{ display: "flex", gap: 16, fontSize: 13, marginBottom: 16, flexWrap: "wrap" }}>
        <Link href="/settings" style={{ color: "var(--color-dim)", textDecoration: "none" }}>
          ← Settings
        </Link>
        <span style={{ color: "var(--color-border)" }}>·</span>
        <span style={{ color: "var(--color-primary)", fontWeight: 600 }}>Team Management</span>
      </div>

      <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--color-primary)", marginBottom: 4 }}>
        Team Management {institutionName && <span style={{ color: "var(--color-secondary)", fontWeight: 400 }}>· {institutionName}</span>}
      </h1>
      <p style={{ fontSize: 13, color: "var(--color-dim)", marginBottom: 24 }}>
        Invite teammates, manage roles, and view your institution&apos;s calculation audit log. No PHI is stored.
      </p>

      {/* Seats summary */}
      {seats && (
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          marginBottom: 20,
          background: "var(--color-card)",
          border: "1px solid var(--color-border)",
          borderRadius: 6,
        }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-dim)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Seats
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "var(--color-primary)", marginTop: 2 }}>
              {seats.used} <span style={{ color: "var(--color-secondary)", fontWeight: 400, fontSize: 14 }}>/ {seats.allocated}</span>
            </div>
          </div>
          {seats.used >= seats.allocated && (
            <a
              href="https://dosys.health/contact?type=department"
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 12, color: "var(--color-primary)", textDecoration: "underline" }}
            >
              Expand seats
            </a>
          )}
        </div>
      )}

      {/* Invite form */}
      <section style={{
        padding: 16,
        marginBottom: 24,
        background: "var(--color-card)",
        border: "1px solid var(--color-border)",
        borderRadius: 6,
      }}>
        <h2 style={{ fontSize: 13, fontWeight: 700, color: "var(--color-primary)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 12 }}>
          Invite a teammate
        </h2>
        <form onSubmit={handleInvite}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 140px auto", gap: 8, alignItems: "end" }}>
            <div>
              <label style={{ display: "block", fontSize: 11, color: "var(--color-secondary)", marginBottom: 4 }}>Email *</label>
              <input
                type="email"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                required
                placeholder="rx@hospital.org"
                style={{ width: "100%", padding: "8px 10px", fontSize: 13, border: "1px solid var(--color-border)", background: "var(--color-card)", color: "var(--color-primary)", borderRadius: 4, boxSizing: "border-box" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, color: "var(--color-secondary)", marginBottom: 4 }}>Full name</label>
              <input
                type="text"
                value={inviteName}
                onChange={e => setInviteName(e.target.value)}
                placeholder="optional"
                style={{ width: "100%", padding: "8px 10px", fontSize: 13, border: "1px solid var(--color-border)", background: "var(--color-card)", color: "var(--color-primary)", borderRadius: 4, boxSizing: "border-box" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, color: "var(--color-secondary)", marginBottom: 4 }}>Credentials</label>
              <input
                type="text"
                value={inviteCreds}
                onChange={e => setInviteCreds(e.target.value)}
                placeholder="e.g. PharmD"
                style={{ width: "100%", padding: "8px 10px", fontSize: 13, border: "1px solid var(--color-border)", background: "var(--color-card)", color: "var(--color-primary)", borderRadius: 4, boxSizing: "border-box" }}
              />
            </div>
            <button
              type="submit"
              disabled={inviting || (!!seats && seats.used >= seats.allocated)}
              style={{
                padding: "9px 16px", fontSize: 13, fontWeight: 600,
                background: "var(--color-primary)", color: "#ffffff", border: "none", borderRadius: 4,
                cursor: inviting ? "wait" : (seats && seats.used >= seats.allocated ? "not-allowed" : "pointer"),
                opacity: inviting || (seats && seats.used >= seats.allocated) ? 0.6 : 1,
                whiteSpace: "nowrap",
              }}
            >
              {inviting ? "Sending..." : "Send invite"}
            </button>
          </div>
          {inviteMsg && (
            <div style={{
              marginTop: 10,
              padding: "8px 12px",
              fontSize: 12,
              background: inviteMsg.type === "ok" ? "#ecfdf5" : "#fff5f5",
              border: `1px solid ${inviteMsg.type === "ok" ? "#6ee7b7" : "#fca5a5"}`,
              color: inviteMsg.type === "ok" ? "#047857" : "#991b1b",
              borderRadius: 4,
            }}>
              {inviteMsg.text}
            </div>
          )}
        </form>
      </section>

      {/* Members table */}
      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 13, fontWeight: 700, color: "var(--color-primary)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>
          Members
        </h2>
        {loading ? (
          <div style={{ padding: 32, textAlign: "center", color: "var(--color-dim)" }}>Loading…</div>
        ) : members && members.length > 0 ? (
          <div style={{ overflowX: "auto", border: "1px solid var(--color-border)", borderRadius: 6, background: "var(--color-card)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "var(--color-bg)", borderBottom: "1px solid var(--color-border)" }}>
                  {["Name", "Email", "Credentials", "Role", "Last sign-in", ""].map(h => (
                    <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "var(--color-secondary)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {members.map(m => (
                  <tr key={m.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                    <td style={{ padding: "10px 12px", color: "var(--color-primary)" }}>
                      {m.full_name}
                      {String(m.id) === user.id && <span style={{ marginLeft: 6, fontSize: 11, color: "var(--color-dim)" }}>(you)</span>}
                    </td>
                    <td style={{ padding: "10px 12px", color: "var(--color-secondary)" }}>{m.email}</td>
                    <td style={{ padding: "10px 12px", color: "var(--color-secondary)" }}>{m.credentials}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <button
                        type="button"
                        onClick={() => handleRoleToggle(m.id, m.institutional_role)}
                        style={{
                          padding: "2px 10px", fontSize: 11, fontWeight: 600,
                          background: m.institutional_role === "admin" ? "#dbeafe" : "var(--color-bg)",
                          color: m.institutional_role === "admin" ? "#1e3a8a" : "var(--color-secondary)",
                          border: `1px solid ${m.institutional_role === "admin" ? "#93c5fd" : "var(--color-border)"}`,
                          borderRadius: 4,
                          cursor: "pointer",
                        }}
                        title="Click to toggle"
                      >
                        {m.institutional_role === "admin" ? "ADMIN" : "USER"}
                      </button>
                    </td>
                    <td style={{ padding: "10px 12px", color: "var(--color-secondary)" }}>
                      {m.last_login ? fmtDate(m.last_login) : <span style={{ color: "var(--color-dim)" }}>never</span>}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right" }}>
                      {String(m.id) !== user.id && (
                        <button
                          type="button"
                          onClick={() => handleRemove(m.id, m.email)}
                          style={{
                            padding: "4px 10px", fontSize: 11, fontWeight: 600,
                            background: "transparent",
                            color: "#991b1b",
                            border: "1px solid #fca5a5",
                            borderRadius: 4,
                            cursor: "pointer",
                          }}
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: 32, textAlign: "center", color: "var(--color-dim)", fontSize: 13, border: "1px dashed var(--color-border)", borderRadius: 6 }}>
            No members yet.
          </div>
        )}
      </section>

      {/* Audit feed */}
      <section>
        <button
          type="button"
          onClick={() => setShowAudit(s => !s)}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "10px 14px", marginBottom: 12,
            background: "var(--color-card)", border: "1px solid var(--color-border)",
            color: "var(--color-primary)", fontSize: 13, fontWeight: 600,
            cursor: "pointer", borderRadius: 4, width: "100%", textAlign: "left",
          }}
        >
          <span style={{ transform: showAudit ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s" }}>▶</span>
          Calculation audit feed (institution-wide, no PHI)
        </button>
        {showAudit && (
          auditLoading ? (
            <div style={{ padding: 32, textAlign: "center", color: "var(--color-dim)" }}>Loading audit…</div>
          ) : audit && audit.length > 0 ? (
            <div style={{ overflowX: "auto", border: "1px solid var(--color-border)", borderRadius: 6, background: "var(--color-card)" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "var(--color-bg)", borderBottom: "1px solid var(--color-border)" }}>
                    {["Date", "User", "Workflow", "Case ID", "Dose", "Interval", "AUC", "Range"].map(h => (
                      <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "var(--color-secondary)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {audit.map(row => (
                    <tr key={row.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                      <td style={{ padding: "8px 10px", color: "var(--color-secondary)", whiteSpace: "nowrap" }}>{fmtDate(row.calculated_at)}</td>
                      <td style={{ padding: "8px 10px", color: "var(--color-primary)" }}>{row.full_name ?? row.username ?? `User ${row.user_id}`}</td>
                      <td style={{ padding: "8px 10px", color: "var(--color-secondary)" }}>{workflowLabel(row.workflow_type)}</td>
                      <td style={{ padding: "8px 10px", color: "var(--color-secondary)", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis" }}>
                        {row.case_id ?? <span style={{ color: "var(--color-dim)" }}>—</span>}
                      </td>
                      <td style={{ padding: "8px 10px", color: "var(--color-primary)", fontWeight: 600 }}>
                        {row.dose_mg != null ? `${row.dose_mg} mg` : "—"}
                      </td>
                      <td style={{ padding: "8px 10px", color: "var(--color-secondary)" }}>
                        {row.interval_hours != null ? `q${row.interval_hours}h` : "—"}
                      </td>
                      <td style={{ padding: "8px 10px", color: "var(--color-secondary)" }}>
                        {row.auc24 != null ? row.auc24.toFixed(0) : "—"}
                      </td>
                      <td style={{ padding: "8px 10px" }}>
                        {row.auc_in_range ? (
                          <span style={{ display: "inline-block", padding: "2px 8px", fontSize: 10, fontWeight: 600, background: "#ecfdf5", color: "#047857", border: "1px solid #6ee7b7", borderRadius: 4 }}>In</span>
                        ) : (
                          <span style={{ display: "inline-block", padding: "2px 8px", fontSize: 10, fontWeight: 600, background: "#fef3c7", color: "#92400e", border: "1px solid #fcd34d", borderRadius: 4 }}>Out</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: 24, textAlign: "center", color: "var(--color-dim)", fontSize: 13, border: "1px dashed var(--color-border)", borderRadius: 6 }}>
              No calculations recorded yet.
            </div>
          )
        )}
      </section>
    </div>
  );
}
