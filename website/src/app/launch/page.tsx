"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

/**
 * SMART on FHIR Launch Page
 *
 * This page is the entry point when an EHR system launches Vancomyzer.
 * The EHR redirects here with two query parameters:
 *   ?iss=<FHIR_SERVER_URL>&launch=<LAUNCH_TOKEN>
 *
 * The page initiates the OAuth2 authorization flow by:
 * 1. Fetching the FHIR server's conformance statement to find the auth endpoints
 * 2. Redirecting to the authorization endpoint with the launch context
 */

function LaunchContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState("Initializing SMART launch...");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const iss = searchParams.get("iss");
    const launch = searchParams.get("launch");

    if (!iss) {
      setError("Missing 'iss' parameter. This page must be launched from an EHR system.");
      return;
    }

    async function initLaunch() {
      try {
        setStatus("Discovering FHIR server endpoints...");

        // Step 1: Fetch the FHIR server's metadata (conformance/capability statement)
        const metadataUrl = `${iss!.replace(/\/$/, "")}/.well-known/smart-configuration`;
        let authEndpoint: string | null = null;
        let tokenEndpoint: string | null = null;

        try {
          const smartConfig = await fetch(metadataUrl).then(r => r.json());
          authEndpoint = smartConfig.authorization_endpoint;
          tokenEndpoint = smartConfig.token_endpoint;
        } catch {
          // Fallback: try /metadata (FHIR CapabilityStatement)
          setStatus("Trying FHIR CapabilityStatement...");
          const capUrl = `${iss!.replace(/\/$/, "")}/metadata`;
          const cap = await fetch(capUrl, { headers: { Accept: "application/fhir+json" } }).then(r => r.json());
          const security = cap?.rest?.[0]?.security;
          const oauthExt = security?.extension?.find((e: { url: string }) =>
            e.url === "http://fhir-registry.smarthealthit.org/StructureDefinition/oauth-uris"
          );
          if (oauthExt?.extension) {
            for (const ext of oauthExt.extension) {
              if (ext.url === "authorize") authEndpoint = ext.valueUri;
              if (ext.url === "token") tokenEndpoint = ext.valueUri;
            }
          }
        }

        if (!authEndpoint || !tokenEndpoint) {
          setError("Could not discover OAuth2 endpoints from the FHIR server. The server may not support SMART on FHIR.");
          return;
        }

        // Step 2: Store server info in sessionStorage for the callback
        sessionStorage.setItem("vancomyzer_smart_state", JSON.stringify({
          iss,
          authEndpoint,
          tokenEndpoint,
          launch,
        }));

        // Step 3: Build the authorization URL
        const clientId = process.env.NEXT_PUBLIC_SMART_CLIENT_ID ?? "vancomyzer-smart-app";
        const redirectUri = `${window.location.origin}/callback`;
        const scope = "launch patient/*.read user/*.read openid fhirUser";
        const state = Math.random().toString(36).substring(2, 15);
        sessionStorage.setItem("vancomyzer_smart_csrf", state);

        const params = new URLSearchParams({
          response_type: "code",
          client_id: clientId,
          redirect_uri: redirectUri,
          scope,
          state,
          aud: iss!,
          ...(launch ? { launch } : {}),
        });

        setStatus("Redirecting to authorization server...");
        window.location.href = `${authEndpoint}?${params.toString()}`;

      } catch (err) {
        setError(`Launch failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    initLaunch();
  }, [searchParams]);

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
        <img src="/logo-signal.svg" alt="Vancomyzer" width={160} height={48} style={{ margin: "0 auto 16px", display: "block" }} />
        <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--color-primary)", marginBottom: 8 }}>
          VANCOMYZER{"\u2122"} SMART Launch
        </h1>
        {error ? (
          <div style={{ padding: 12, background: "#fff5f5", border: "1px solid #fca5a5", color: "#991b1b", fontSize: 13, textAlign: "left" }}>
            {error}
          </div>
        ) : (
          <div>
            <div style={{
              width: 32, height: 32, margin: "16px auto",
              border: "3px solid var(--color-border)",
              borderTopColor: "var(--color-primary)",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
            }} />
            <p style={{ fontSize: 13, color: "var(--color-secondary)" }}>{status}</p>
          </div>
        )}
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}

export default function LaunchPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>Loading...</div>}>
      <LaunchContent />
    </Suspense>
  );
}
