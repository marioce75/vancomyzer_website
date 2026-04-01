"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuth } from "./AuthContext";

// ---------------------------------------------------------------------------
// Types — mirrors server-side InstitutionalSettings
// ---------------------------------------------------------------------------

export interface InstitutionalSettings {
  auc24_target_low: number;
  auc24_target_high: number;
  auc24_target_mid: number;
  trough_target_low: number;
  trough_target_high: number;
  max_infusion_rate_mg_per_min: number;
  min_infusion_duration_hours: number;
  loading_dose_mg_per_kg: number;
  loading_dose_max_mg: number;
  loading_dose_enabled: boolean;
  max_single_dose_mg: number;
  max_daily_dose_mg: number;
  default_pk_model: string;
  min_post_infusion_hours: number;
  pulse_dose_min_post_infusion_hours: number;
  show_math_by_default: boolean;
  default_graph_zoom_hours: number;
  institution_name: string;
  institution_protocol_url: string;
}

export const DEFAULT_INSTITUTIONAL_SETTINGS: InstitutionalSettings = {
  auc24_target_low: 400,
  auc24_target_high: 600,
  auc24_target_mid: 500,
  trough_target_low: 10,
  trough_target_high: 20,
  max_infusion_rate_mg_per_min: 10,
  min_infusion_duration_hours: 1,
  loading_dose_mg_per_kg: 25,
  loading_dose_max_mg: 3000,
  loading_dose_enabled: true,
  max_single_dose_mg: 2000,
  max_daily_dose_mg: 4500,
  default_pk_model: "colin_2019",
  min_post_infusion_hours: 0.5,
  pulse_dose_min_post_infusion_hours: 2.0,
  show_math_by_default: true,
  default_graph_zoom_hours: 96,
  institution_name: "",
  institution_protocol_url: "",
};

interface InstitutionalSettingsContextValue {
  settings: InstitutionalSettings;
  institution: string;
  loading: boolean;
  updateSettings: (partial: Partial<InstitutionalSettings>) => Promise<{ ok: boolean; error?: string }>;
  refresh: () => Promise<void>;
}

const InstitutionalSettingsContext = createContext<InstitutionalSettingsContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function InstitutionalSettingsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<InstitutionalSettings>(DEFAULT_INSTITUTIONAL_SETTINGS);
  const [institution, setInstitution] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        if (data.settings) setSettings({ ...DEFAULT_INSTITUTIONAL_SETTINGS, ...data.settings });
        if (data.institution) setInstitution(data.institution);
      }
    } catch { /* offline or error — use defaults */ }
    setLoading(false);
  }, []);

  // Fetch on mount and when user changes (login/logout)
  useEffect(() => {
    fetchSettings();
  }, [fetchSettings, user?.id]);

  const updateSettings = useCallback(async (partial: Partial<InstitutionalSettings>) => {
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(partial),
      });
      const data = await res.json();
      if (!res.ok) return { ok: false, error: data.error ?? "Failed to save." };
      if (data.settings) setSettings({ ...DEFAULT_INSTITUTIONAL_SETTINGS, ...data.settings });
      return { ok: true };
    } catch {
      return { ok: false, error: "Network error." };
    }
  }, []);

  return (
    <InstitutionalSettingsContext.Provider value={{ settings, institution, loading, updateSettings, refresh: fetchSettings }}>
      {children}
    </InstitutionalSettingsContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useInstitutionalSettings(): InstitutionalSettingsContextValue {
  const ctx = useContext(InstitutionalSettingsContext);
  if (!ctx) throw new Error("useInstitutionalSettings must be used within <InstitutionalSettingsProvider>");
  return ctx;
}
