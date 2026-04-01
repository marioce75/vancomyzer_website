"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { SmartContext as SmartCtx, VancomycinFhirData } from "@/lib/fhir";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SmartContextValue {
  /** Whether we're inside a SMART on FHIR launch (vs standalone login) */
  isSmartLaunch: boolean;
  /** The SMART context (patient ID, FHIR server, token) */
  smartContext: SmartCtx | null;
  /** Fetched patient data from FHIR */
  patientData: VancomycinFhirData | null;
  /** Loading state */
  loading: boolean;
  /** Error message if FHIR fetch failed */
  error: string | null;
  /** Re-fetch patient data from FHIR */
  refreshPatientData: () => Promise<void>;
}

const SmartReactContext = createContext<SmartContextValue>({
  isSmartLaunch: false,
  smartContext: null,
  patientData: null,
  loading: false,
  error: null,
  refreshPatientData: async () => {},
});

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function SmartProvider({ children }: { children: React.ReactNode }) {
  const [smartContext, setSmartContext] = useState<SmartCtx | null>(null);
  const [patientData, setPatientData] = useState<VancomycinFhirData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check for SMART context in sessionStorage on mount
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("vancomyzer_smart_context");
      if (raw) {
        const ctx = JSON.parse(raw) as SmartCtx;
        if (ctx.accessToken && ctx.patientId && ctx.fhirServerUrl) {
          setSmartContext(ctx);
        }
      }
    } catch { /* no SMART context — standalone mode */ }
  }, []);

  // Fetch patient data when SMART context is available
  const fetchPatientData = useCallback(async () => {
    if (!smartContext) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/fhir/patient", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fhirServerUrl: smartContext.fhirServerUrl,
          patientId: smartContext.patientId,
          accessToken: smartContext.accessToken,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `FHIR fetch failed (${res.status}).`);
        return;
      }

      const data = await res.json();
      setPatientData(data);
    } catch (err) {
      setError(`Network error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  }, [smartContext]);

  // Auto-fetch on SMART context change
  useEffect(() => {
    if (smartContext) {
      fetchPatientData();
    }
  }, [smartContext, fetchPatientData]);

  const isSmartLaunch = smartContext !== null;

  return (
    <SmartReactContext.Provider value={{
      isSmartLaunch,
      smartContext,
      patientData,
      loading,
      error,
      refreshPatientData: fetchPatientData,
    }}>
      {children}
    </SmartReactContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSmart(): SmartContextValue {
  return useContext(SmartReactContext);
}
