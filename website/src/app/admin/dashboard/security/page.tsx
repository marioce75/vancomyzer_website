"use client";

import { useState, useEffect } from "react";

interface AuditEvent {
  id: number;
  timestamp: string;
  action: string;
  username: string | null;
  ip_address: string | null;
  severity: string;
  details: string;
}

interface MfaUser {
  id: number;
  username: string;
  role: string;
  mfa_enabled: number;
}

export default function SecurityPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [mfaUsers, setMfaUsers] = useState<MfaUser[]>([]);
  const [filterAction, setFilterAction] = useState("all");
  const [loading, setLoading] = useState(true);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [mfaToken, setMfaToken] = useState("");
  const [mfaMessage, setMfaMessage] = useState("");
  const [showMfaSetup, setShowMfaSetup] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/dashboard/overview");
        if (res.ok) {
          const data = await res.json();
          setEvents(data.securityEvents ?? []);
          setMfaUsers(data.mfaUsers ?? []);
        }
      } catch { /* ignore */ }
      setLoading(false);
    })();
  }, []);

  const actionTypes = ["all", ...Array.from(new Set(events.map((e) => e.action)))];
  const filtered = filterAction === "all" ? events : events.filter((e) => e.action === filterAction);

  const severityBadge = (sev: string) => {
    switch (sev) {
      case "critical": return "bg-red-100 text-red-800";
      case "error": return "bg-red-50 text-red-700";
      case "warn": return "bg-amber-100 text-amber-800";
      default: return "bg-gray-100 text-gray-600";
    }
  };

  const handleMfaSetup = async () => {
    setMfaMessage("");
    setQrCode(null);
    try {
      const res = await fetch("/api/auth/mfa/setup", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setQrCode(data.qrCode);
        setShowMfaSetup(true);
      } else {
        const data = await res.json();
        setMfaMessage(data.error ?? "MFA setup failed.");
      }
    } catch {
      setMfaMessage("MFA setup request failed.");
    }
  };

  const handleMfaVerify = async () => {
    setMfaMessage("");
    try {
      const res = await fetch("/api/auth/mfa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: mfaToken }),
      });
      const data = await res.json();
      if (res.ok) {
        setMfaMessage("MFA enabled successfully.");
        setShowMfaSetup(false);
        setQrCode(null);
        setMfaToken("");
      } else {
        setMfaMessage(data.error ?? "Verification failed.");
      }
    } catch {
      setMfaMessage("Verification request failed.");
    }
  };

  const downloadCsv = () => {
    const header = "ID,Timestamp,Action,Username,IP Address,Severity,Details\n";
    const rows = events.map((e) =>
      `${e.id},"${e.timestamp}","${e.action}","${e.username ?? ""}","${e.ip_address ?? ""}","${e.severity}","${(e.details ?? "").replace(/"/g, '""')}"`
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit_log_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="text-gray-500 text-center py-20">Loading security data...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1" style={{ color: "#1e4d8c" }}>Security</h1>
      <p className="text-sm text-gray-500 mb-6">Audit log, MFA management, and account security</p>

      {/* MFA Management */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 mb-6">
        <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-3">MFA Status</h2>
        <div className="flex flex-wrap gap-3 mb-4">
          {mfaUsers.length === 0 ? (
            <p className="text-xs text-gray-400">No admin users found.</p>
          ) : (
            mfaUsers.map((u) => (
              <div key={u.id} className="flex items-center gap-2 px-3 py-1.5 border border-gray-200 rounded-md text-xs">
                <span className="font-semibold text-gray-700">{u.username}</span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                  u.role === "admin" ? "bg-purple-100 text-purple-800" : "bg-gray-100 text-gray-700"
                }`}>{u.role}</span>
                {u.mfa_enabled ? (
                  <span className="bg-green-100 text-green-800 px-1.5 py-0.5 rounded text-[10px] font-semibold">MFA ON</span>
                ) : (
                  <span className="bg-red-100 text-red-800 px-1.5 py-0.5 rounded text-[10px] font-semibold">MFA OFF</span>
                )}
              </div>
            ))
          )}
        </div>

        <button
          onClick={handleMfaSetup}
          className="px-4 py-2 text-sm font-medium text-white rounded-md transition-colors hover:opacity-90"
          style={{ background: "#1e4d8c" }}
        >
          Setup MFA for My Account
        </button>

        {mfaMessage && (
          <p className="mt-2 text-xs text-amber-700">{mfaMessage}</p>
        )}

        {showMfaSetup && qrCode && (
          <div className="mt-4 p-4 border border-gray-200 rounded-md bg-gray-50 max-w-sm">
            <p className="text-xs text-gray-600 mb-2">Scan this QR code with your authenticator app:</p>
            <img src={qrCode} alt="MFA QR Code" className="mb-3 border border-gray-300 rounded" />
            <div className="flex gap-2">
              <input
                type="text"
                value={mfaToken}
                onChange={(e) => setMfaToken(e.target.value)}
                placeholder="6-digit code"
                maxLength={6}
                className="flex-1 px-3 py-1.5 border border-gray-300 rounded text-sm"
              />
              <button
                onClick={handleMfaVerify}
                className="px-3 py-1.5 text-sm font-medium text-white bg-green-700 rounded hover:bg-green-800"
              >
                Verify
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Audit Log */}
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500">Security Audit Log</h2>
          <div className="flex gap-2">
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="px-2 py-1 text-xs border border-gray-300 rounded"
            >
              {actionTypes.map((a) => (
                <option key={a} value={a}>{a === "all" ? "All Actions" : a}</option>
              ))}
            </select>
            <button
              onClick={downloadCsv}
              className="px-3 py-1 text-xs font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded hover:bg-gray-200"
            >
              Download CSV
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-3 py-2 text-left font-semibold" style={{ color: "#1e4d8c" }}>Timestamp</th>
                <th className="px-3 py-2 text-left font-semibold" style={{ color: "#1e4d8c" }}>Action</th>
                <th className="px-3 py-2 text-left font-semibold" style={{ color: "#1e4d8c" }}>Username</th>
                <th className="px-3 py-2 text-left font-semibold" style={{ color: "#1e4d8c" }}>IP</th>
                <th className="px-3 py-2 text-left font-semibold" style={{ color: "#1e4d8c" }}>Severity</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-gray-400">No events found.</td>
                </tr>
              ) : (
                filtered.slice(0, 100).map((e) => (
                  <tr key={e.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{new Date(e.timestamp).toLocaleString()}</td>
                    <td className="px-3 py-2 font-mono text-gray-800">{e.action}</td>
                    <td className="px-3 py-2 text-gray-600">{e.username ?? "-"}</td>
                    <td className="px-3 py-2 text-gray-500">{e.ip_address ?? "-"}</td>
                    <td className="px-3 py-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${severityBadge(e.severity)}`}>
                        {e.severity}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {filtered.length > 100 && (
          <p className="text-xs text-gray-400 mt-2">Showing first 100 of {filtered.length} events.</p>
        )}
      </div>
    </div>
  );
}
