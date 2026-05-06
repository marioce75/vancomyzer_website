"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function MfaVerifyPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/mfa/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: code }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Verification failed.");
      return;
    }

    // MFA verified — redirect to dashboard
    router.push("/admin/dashboard");
  };

  return (
    <div style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 400, background: "#fff", border: "1px solid #cbd5e0", padding: 32, borderRadius: 8, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <a href="https://dosys.health" target="_blank" rel="noopener noreferrer" aria-label="Visit dosys.health" style={{ display: "block", width: 160, margin: "0 auto 12px" }}>
            <img src="/logo-signal.svg" alt="Dōsys™" width={160} height={48} style={{ display: "block" }} />
          </a>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1e4d8c", margin: 0 }}>Two-Factor Authentication</h1>
          <p style={{ fontSize: 13, color: "#718096", marginTop: 8 }}>
            Enter the 6-digit code from your authenticator app.
          </p>
        </div>

        {error && (
          <div style={{ padding: "10px 14px", marginBottom: 16, background: "#fff5f5", border: "1px solid #fca5a5", color: "#991b1b", fontSize: 13, borderRadius: 4 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleVerify}>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="000000"
            maxLength={6}
            autoFocus
            style={{
              width: "100%", padding: "14px 16px", fontSize: 24, fontWeight: 700,
              textAlign: "center", letterSpacing: "0.5em", border: "2px solid #cbd5e0",
              borderRadius: 8, boxSizing: "border-box", fontFamily: "'Share Tech Mono', monospace",
            }}
          />
          <button
            type="submit"
            disabled={code.length !== 6 || loading}
            style={{
              width: "100%", padding: 14, fontSize: 14, fontWeight: 600, marginTop: 16,
              background: code.length === 6 ? "#1e4d8c" : "#cbd5e0",
              color: code.length === 6 ? "#fff" : "#a0aec0",
              border: "none", borderRadius: 4,
              cursor: code.length === 6 && !loading ? "pointer" : "not-allowed",
            }}
          >
            {loading ? "Verifying..." : "Verify"}
          </button>
        </form>
      </div>
    </div>
  );
}
