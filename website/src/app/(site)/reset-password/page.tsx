"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // No token = show forgot password form (request reset email)
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error ?? "Failed."); return; }
    setEmailSent(true);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) { setError("Passwords do not match."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    setLoading(true);
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error ?? "Failed."); return; }
    setSuccess(true);
  };

  const inputStyle = {
    width: "100%", padding: "10px 12px", fontSize: 14,
    border: "1px solid #a0aec0", background: "#ffffff", color: "#1a202c",
    boxSizing: "border-box" as const, borderRadius: 4,
  };

  return (
    <div style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{
        width: "100%", maxWidth: 420, background: "#ffffff",
        border: "1px solid #cbd5e0", padding: 32,
        boxShadow: "0 4px 12px rgba(0,0,0,0.08)", borderRadius: 8,
      }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <a href="https://dosys.health" target="_blank" rel="noopener noreferrer" aria-label="Visit dosys.health" style={{ display: "block", width: 160, margin: "0 auto 12px" }}>
            <img src="/logo-signal.svg" alt="Dōsys™" width={160} height={48} style={{ display: "block" }} />
          </a>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1e4d8c", margin: 0 }}>
            {token ? "Set New Password" : "Forgot Password"}
          </h1>
        </div>

        {error && (
          <div style={{ padding: "10px 14px", marginBottom: 16, background: "#fff5f5", border: "1px solid #fca5a5", color: "#991b1b", fontSize: 13, borderRadius: 4 }}>
            {error}
          </div>
        )}

        {/* Success states */}
        {emailSent && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✉️</div>
            <p style={{ fontSize: 14, color: "#047857", fontWeight: 600 }}>Reset link sent!</p>
            <p style={{ fontSize: 13, color: "#4a5568", marginTop: 8, lineHeight: 1.6 }}>
              If an account with that email exists, you will receive a password reset link. Check your inbox (and spam folder).
            </p>
            <Link href="/login" style={{ display: "inline-block", marginTop: 20, fontSize: 13, color: "#1e4d8c", fontWeight: 600, textDecoration: "none" }}>
              ← Back to Sign In
            </Link>
          </div>
        )}

        {success && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
            <p style={{ fontSize: 14, color: "#047857", fontWeight: 600 }}>Password reset successfully!</p>
            <p style={{ fontSize: 13, color: "#4a5568", marginTop: 8 }}>You can now sign in with your new password.</p>
            <Link href="/login" style={{
              display: "inline-block", marginTop: 16, padding: "10px 24px",
              background: "#1e4d8c", color: "#ffffff", textDecoration: "none",
              fontWeight: 600, fontSize: 14, borderRadius: 4,
            }}>
              Sign In
            </Link>
          </div>
        )}

        {/* Forgot password form — request email */}
        {!token && !emailSent && (
          <form onSubmit={handleForgotPassword}>
            <p style={{ fontSize: 13, color: "#4a5568", marginBottom: 16, lineHeight: 1.5 }}>
              Enter the email address associated with your account. We&apos;ll send you a link to reset your password.
            </p>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#4a5568", marginBottom: 4 }}>Email</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                required placeholder="pharmacist@hospital.org" style={inputStyle}
              />
            </div>
            <button type="submit" disabled={loading} style={{
              width: "100%", padding: 12, fontSize: 14, fontWeight: 600,
              background: "#1e4d8c", color: "#ffffff", border: "none",
              cursor: loading ? "wait" : "pointer", opacity: loading ? 0.7 : 1, borderRadius: 4,
            }}>
              {loading ? "Sending..." : "Send Reset Link"}
            </button>
            <p style={{ textAlign: "center", marginTop: 16, fontSize: 13, color: "#718096" }}>
              <Link href="/login" style={{ color: "#1e4d8c", fontWeight: 600, textDecoration: "none" }}>← Back to Sign In</Link>
            </p>
          </form>
        )}

        {/* Reset password form — set new password */}
        {token && !success && (
          <form onSubmit={handleResetPassword}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#4a5568", marginBottom: 4 }}>New Password</label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)}
                required placeholder="Min 8 chars, upper+lower+number" style={inputStyle}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#4a5568", marginBottom: 4 }}>Confirm New Password</label>
              <input
                type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                required placeholder="Re-enter password" style={inputStyle}
              />
            </div>
            <button type="submit" disabled={loading} style={{
              width: "100%", padding: 12, fontSize: 14, fontWeight: 600,
              background: "#1e4d8c", color: "#ffffff", border: "none",
              cursor: loading ? "wait" : "pointer", opacity: loading ? 0.7 : 1, borderRadius: 4,
            }}>
              {loading ? "Resetting..." : "Reset Password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
