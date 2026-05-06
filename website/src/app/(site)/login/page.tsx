"use client";

import { useState, useEffect, useRef } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";

function magicErrorMessage(code: string | null): string {
  switch (code) {
    case "missing": return "Sign-in link missing. Request a new one below.";
    case "invalid": return "Sign-in link expired or invalid. Request a new one below.";
    default: return "";
  }
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const expired = searchParams.get("expired") === "true";
  const magicToken = searchParams.get("magic");
  const magicError = searchParams.get("magic_error");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(
    expired ? "Your session has expired. Please log in again." : magicErrorMessage(magicError)
  );
  const [loading, setLoading] = useState(false);

  // Magic-link form state
  const [magicEmail, setMagicEmail] = useState("");
  const [magicSending, setMagicSending] = useState(false);
  const [magicSent, setMagicSent] = useState(false);
  const [showMagic, setShowMagic] = useState(false);

  // Auto-complete magic-link sign-in when redirected with ?magic=<token>
  const magicAttemptedRef = useRef(false);
  useEffect(() => {
    if (!magicToken || magicAttemptedRef.current) return;
    magicAttemptedRef.current = true;
    setLoading(true);
    signIn("magic-link", { token: magicToken, redirect: false }).then(result => {
      setLoading(false);
      if (result?.error) {
        if (result.error === "PENDING") setError("Your account is pending approval.");
        else if (result.error === "DISABLED") setError("Your account has been disabled.");
        else if (result.error === "LOCKED") setError("Account temporarily locked. Try again in 15 minutes.");
        else setError("Sign-in link expired or invalid. Request a new one below.");
        return;
      }
      router.push("/calculator");
      router.refresh();
    });
  }, [magicToken, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      username,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      if (result.error === "PENDING") {
        setError("Your account is pending approval. You will be notified by email when access is granted.");
      } else if (result.error === "DISABLED") {
        setError("Your account has been disabled. Contact your administrator.");
      } else if (result.error === "LOCKED") {
        setError("Account temporarily locked due to too many failed attempts. Try again in 15 minutes.");
      } else {
        setError("Incorrect username or password.");
      }
      return;
    }

    router.push("/calculator");
    router.refresh();
  };

  const handleMagicSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMagicSending(true);
    try {
      const res = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: magicEmail }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Could not send sign-in link. Try again.");
      } else {
        setMagicSent(true);
      }
    } catch {
      setError("Network error. Try again.");
    } finally {
      setMagicSending(false);
    }
  };

  return (
    <div style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{
        width: "100%",
        maxWidth: 420,
        background: "#ffffff",
        border: "1px solid #cbd5e0",
        padding: 32,
        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
        borderRadius: 8,
      }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <a href="https://dosys.health" target="_blank" rel="noopener noreferrer" aria-label="Visit dosys.health" style={{ display: "block", width: 160, margin: "0 auto 12px" }}>
            <img src="/logo-signal.svg" alt="Dōsys™" width={160} height={48} style={{ display: "block" }} />
          </a>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1e4d8c", margin: 0 }}>
            Sign in to Vancomyzer
          </h1>
          <p style={{ fontSize: 13, color: "#718096", marginTop: 6 }}>
            Clinical decision support for vancomycin dosing
          </p>
        </div>

        {error && (
          <div style={{
            padding: "10px 14px", marginBottom: 16,
            background: "#fff5f5", border: "1px solid #fca5a5", color: "#991b1b", fontSize: 13, borderRadius: 4,
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#4a5568", marginBottom: 4 }}>
              Username or Email
            </label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              autoComplete="username"
              style={{
                width: "100%", padding: "10px 12px", fontSize: 14,
                border: "1px solid #a0aec0", background: "#ffffff", color: "#1a202c",
                boxSizing: "border-box", borderRadius: 4,
              }}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#4a5568", marginBottom: 4 }}>
              Password
            </label>
            <div style={{ position: "relative" }}>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                style={{
                  width: "100%", padding: "10px 12px", paddingRight: 60, fontSize: 14,
                  border: "1px solid #a0aec0", background: "#ffffff", color: "#1a202c",
                  boxSizing: "border-box", borderRadius: 4,
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", color: "#718096", cursor: "pointer", fontSize: 12,
                }}
              >
                {showPassword ? "HIDE" : "SHOW"}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%", padding: "12px", fontSize: 14, fontWeight: 600,
              background: "#1e4d8c", color: "#ffffff", border: "none",
              cursor: loading ? "wait" : "pointer", opacity: loading ? 0.7 : 1,
              borderRadius: 4,
            }}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div style={{ position: "relative", margin: "20px 0 16px", textAlign: "center" }}>
          <hr style={{ border: "none", borderTop: "1px solid #e2e8f0", margin: 0 }} />
          <span style={{
            position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)",
            background: "#ffffff", padding: "0 12px", fontSize: 11, color: "#718096", letterSpacing: "0.05em",
          }}>OR</span>
        </div>

        {magicSent ? (
          <div style={{
            padding: "12px 14px", marginBottom: 4,
            background: "#ecfdf5", border: "1px solid #6ee7b7", color: "#065f46", fontSize: 13, borderRadius: 4,
            lineHeight: 1.5,
          }}>
            <strong>Check your email.</strong> If an account exists for that email, a sign-in link has been sent. The link expires in 15 minutes.
          </div>
        ) : showMagic ? (
          <form onSubmit={handleMagicSubmit}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#4a5568", marginBottom: 4 }}>
              Email address
            </label>
            <input
              type="email"
              value={magicEmail}
              onChange={e => setMagicEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="you@hospital.org"
              style={{
                width: "100%", padding: "10px 12px", fontSize: 14, marginBottom: 10,
                border: "1px solid #a0aec0", background: "#ffffff", color: "#1a202c",
                boxSizing: "border-box", borderRadius: 4,
              }}
            />
            <button
              type="submit"
              disabled={magicSending}
              style={{
                width: "100%", padding: "10px", fontSize: 13, fontWeight: 600,
                background: "#0d9488", color: "#ffffff", border: "none",
                cursor: magicSending ? "wait" : "pointer", opacity: magicSending ? 0.7 : 1,
                borderRadius: 4,
              }}
            >
              {magicSending ? "Sending link..." : "Email me a sign-in link"}
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setShowMagic(true)}
            style={{
              width: "100%", padding: "10px", fontSize: 13, fontWeight: 500,
              background: "#ffffff", color: "#0d9488", border: "1px solid #0d9488",
              cursor: "pointer", borderRadius: 4,
            }}
          >
            Sign in with email link instead
          </button>
        )}

        <p style={{ textAlign: "center", marginTop: 16, fontSize: 13 }}>
          <Link href="/reset-password" style={{ color: "#718096", textDecoration: "none" }}>
            Forgot password?
          </Link>
        </p>
        <p style={{ textAlign: "center", marginTop: 8, fontSize: 13, color: "#718096" }}>
          Don&apos;t have an account?{" "}
          <Link href="/register" style={{ color: "#1e4d8c", textDecoration: "none", fontWeight: 600 }}>
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
