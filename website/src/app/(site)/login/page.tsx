"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const expired = searchParams.get("expired") === "true";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(expired ? "Your session has expired. Please log in again." : "");
  const [loading, setLoading] = useState(false);

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
      } else {
        setError("Incorrect username or password.");
      }
      return;
    }

    router.push("/calculator");
    router.refresh();
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
          <img src="/favicon.svg" alt="Vancomyzer" width={48} height={48} style={{ margin: "0 auto 12px" }} />
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

        <p style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: "#718096" }}>
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
