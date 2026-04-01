"use client";

import { useState, useEffect, useCallback } from "react";

interface PendingUser {
  id: number; full_name: string; credentials: string; institution: string | null;
  email: string; username: string; created_at: string;
}

interface ActiveUser {
  id: number; full_name: string; username: string; email: string;
  credentials: string; institution: string | null; last_login: string | null; role: string;
}

export default function AdminPage() {
  const [pending, setPending] = useState<PendingUser[]>([]);
  const [active, setActive] = useState<ActiveUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const fetchData = useCallback(async () => {
    const res = await fetch("/api/admin");
    if (res.ok) {
      const data = await res.json();
      setPending(data.pending ?? []);
      setActive(data.active ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAction = async (action: string, userId: number) => {
    setMessage("");
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, userId }),
    });
    const data = await res.json();
    setMessage(data.message ?? data.error ?? "Done.");
    fetchData();
  };

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#718096" }}>Loading admin panel...</div>;

  const th = { padding: "8px 12px", textAlign: "left" as const, fontSize: 12, fontWeight: 600, color: "#1e4d8c", borderBottom: "2px solid #cbd5e0", background: "#f7fafc" };
  const td = { padding: "8px 12px", fontSize: 12, color: "#2d3748", borderBottom: "1px solid #e2e8f0" };
  const btn = (bg: string) => ({ padding: "4px 12px", fontSize: 11, fontWeight: 600, border: "none", cursor: "pointer", borderRadius: 4, color: "#fff", background: bg });

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 16px 80px" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1e4d8c", marginBottom: 4 }}>Admin Panel</h1>
      <p style={{ fontSize: 13, color: "#718096", marginBottom: 24 }}>User management for Vancomyzer™</p>

      {message && (
        <div style={{ padding: "8px 14px", marginBottom: 16, background: "#ecfdf5", border: "1px solid #6ee7b7", color: "#047857", fontSize: 13, borderRadius: 4 }}>
          {message}
        </div>
      )}

      <h2 style={{ fontSize: 14, fontWeight: 700, color: "#1e4d8c", marginBottom: 8 }}>
        Pending Registrations ({pending.length})
      </h2>
      {pending.length === 0 ? (
        <p style={{ fontSize: 13, color: "#a0aec0", marginBottom: 24 }}>No pending registrations.</p>
      ) : (
        <div style={{ overflowX: "auto", marginBottom: 24 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", border: "1px solid #e2e8f0" }}>
            <thead>
              <tr>
                <th style={th}>Name</th><th style={th}>Credentials</th><th style={th}>Institution</th>
                <th style={th}>Email</th><th style={th}>Username</th><th style={th}>Registered</th><th style={th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pending.map(u => (
                <tr key={u.id}>
                  <td style={td}>{u.full_name}</td>
                  <td style={td}>{u.credentials}</td>
                  <td style={td}>{u.institution ?? "—"}</td>
                  <td style={td}>{u.email}</td>
                  <td style={td}><strong>{u.username}</strong></td>
                  <td style={td}>{new Date(u.created_at).toLocaleDateString()}</td>
                  <td style={td}>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button onClick={() => handleAction("approve", u.id)} style={btn("#047857")}>APPROVE</button>
                      <button onClick={() => handleAction("disable", u.id)} style={btn("#991b1b")}>REJECT</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 style={{ fontSize: 14, fontWeight: 700, color: "#1e4d8c", marginBottom: 8 }}>
        Active Users ({active.length})
      </h2>
      {active.length === 0 ? (
        <p style={{ fontSize: 13, color: "#a0aec0" }}>No active users.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", border: "1px solid #e2e8f0" }}>
            <thead>
              <tr>
                <th style={th}>Name</th><th style={th}>Username</th><th style={th}>Email</th>
                <th style={th}>Credentials</th><th style={th}>Institution</th><th style={th}>Last Login</th><th style={th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {active.map(u => (
                <tr key={u.id}>
                  <td style={td}>{u.full_name}</td>
                  <td style={td}><strong>{u.username}</strong></td>
                  <td style={td}>{u.email}</td>
                  <td style={td}>{u.credentials}</td>
                  <td style={td}>{u.institution ?? "—"}</td>
                  <td style={td}>{u.last_login ? new Date(u.last_login).toLocaleString() : "Never"}</td>
                  <td style={td}>
                    {u.role !== "admin" && (
                      <button onClick={() => handleAction("disable", u.id)} style={btn("#991b1b")}>DISABLE</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
