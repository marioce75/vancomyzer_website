"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";

/**
 * SMART on FHIR Callback Page
 *
 * Handles the OAuth2 callback from the EHR authorization server.
 * Receives the authorization code and exchanges it for an access token.
 */

function CallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState("Completing authorization...");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const errorParam = searchParams.get("error");
    const errorDesc = searchParams.get("error_description");

    if (errorParam) {
      setError(`Authorization denied: ${errorDesc ?? errorParam}`);
      return;
    }

    if (!code) {
      setError("Missing authorization code. The EHR may have denied access.");
      return;
    }

    // Verify CSRF state
    const savedState = sessionStorage.getItem("vancomyzer_smart_csrf");
    if (state && savedState && state !== savedState) {
      setError("State mismatch — possible CSRF attack. Please relaunch from the EHR.");
      return;
    }

    async function exchangeToken() {
      try {
        const smartState = sessionStorage.getItem("vancomyzer_smart_state");
        if (!smartState) {
          setError("Missing SMART launch context. Please relaunch from the EHR.");
          return;
        }

        const { iss, tokenEndpoint } = JSON.parse(smartState);
        const clientId = process.env.NEXT_PUBLIC_SMART_CLIENT_ID ?? "vancomyzer-smart-app";
        const redirectUri = `${window.location.origin}/callback`;

        setStatus("Exchanging authorization code for token...");

        // Exchange code for token via backend API (keeps client_secret server-side)
        const res = await fetch("/api/fhir/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code,
            tokenEndpoint,
            clientId,
            redirectUri,
            iss,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error ?? `Token exchange failed (${res.status}).`);
          return;
        }

        const tokenData = await res.json();

        // Store SMART context in sessionStorage
        sessionStorage.setItem("vancomyzer_smart_context", JSON.stringify({
          patientId: tokenData.patient,
          userId: tokenData.fhirUser ?? tokenData.user,
          encounterId: tokenData.encounter,
          fhirServerUrl: iss,
          accessToken: tokenData.access_token,
          tokenExpiry: tokenData.expires_in ? Date.now() + tokenData.expires_in * 1000 : undefined,
          refreshToken: tokenData.refresh_token,
          scope: tokenData.scope,
        }));

        // Clean up
        sessionStorage.removeItem("vancomyzer_smart_state");
        sessionStorage.removeItem("vancomyzer_smart_csrf");

        setStatus("Authorization successful! Loading patient data...");

        // Redirect to calculator
        setTimeout(() => router.push("/calculator"), 500);

      } catch (err) {
        setError(`Token exchange failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    exchangeToken();
  }, [searchParams, router]);

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "var(--color-bg)",
    }}>
      <div style={{
        maxWidth: 480,
        padding: 32,
        textAlign: "center",
        background: "var(--color-card, #fff)",
        border: "1px solid var(--color-border)",
        boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
      }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-signal.svg" alt="Vancomyzer" width={48} height={48} style={{ margin: "0 auto 16px" }} />
        {error ? (
          <>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: "#991b1b", marginBottom: 8 }}>Authorization Failed</h1>
            <div style={{ padding: 12, background: "#fff5f5", border: "1px solid #fca5a5", color: "#991b1b", fontSize: 13, textAlign: "left" }}>
              {error}
            </div>
            <p style={{ fontSize: 12, color: "var(--color-dim)", marginTop: 12 }}>
              Please close this window and relaunch Vancomyzer from your EHR.
            </p>
          </>
        ) : (
          <>
            <div style={{
              width: 32, height: 32, margin: "16px auto",
              border: "3px solid var(--color-border)",
              borderTopColor: "var(--color-primary)",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
            }} />
            <p style={{ fontSize: 13, color: "var(--color-secondary)" }}>{status}</p>
          </>
        )}
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}

export default function CallbackPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>Loading...</div>}>
      <CallbackContent />
    </Suspense>
  );
}
