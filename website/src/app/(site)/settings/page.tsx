"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useInstitutionalSettings } from "@/contexts/InstitutionalSettingsContext";
import Link from "next/link";
import ReferralCard from "@/components/ReferralCard";
import DiscountStatusCard from "@/components/DiscountStatusCard";

interface SettingField {
  key: string;
  label: string;
  type: "number" | "boolean" | "text";
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  description?: string;
  section: string;
}

const FIELDS: SettingField[] = [
  // AUC Targets
  { key: "auc24_target_low", label: "AUC₂₄ Target Low", type: "number", unit: "mg·h/L", min: 200, max: 800, step: 10, section: "AUC Targets", description: "Lower bound of therapeutic AUC range" },
  { key: "auc24_target_high", label: "AUC₂₄ Target High", type: "number", unit: "mg·h/L", min: 200, max: 800, step: 10, section: "AUC Targets", description: "Upper bound of therapeutic AUC range" },
  { key: "auc24_target_mid", label: "AUC₂₄ Target Midpoint", type: "number", unit: "mg·h/L", min: 200, max: 800, step: 10, section: "AUC Targets", description: "Optimization target for dose selection" },

  // Trough Targets
  { key: "trough_target_low", label: "Trough Reference Low", type: "number", unit: "mcg/mL", min: 5, max: 25, step: 1, section: "Trough Reference" },
  { key: "trough_target_high", label: "Trough Reference High", type: "number", unit: "mcg/mL", min: 10, max: 30, step: 1, section: "Trough Reference" },

  // Infusion Policy
  { key: "max_infusion_rate_mg_per_min", label: "Max Infusion Rate", type: "number", unit: "mg/min", min: 5, max: 15, step: 1, section: "Infusion Policy", description: "FDA labeling: 10 mg/min maximum" },
  { key: "min_infusion_duration_hours", label: "Min Infusion Duration", type: "number", unit: "hours", min: 0.5, max: 3, step: 0.25, section: "Infusion Policy" },

  // Loading Dose
  { key: "loading_dose_enabled", label: "Show Loading Dose", type: "boolean", section: "Loading Dose Policy" },
  { key: "loading_dose_mg_per_kg", label: "Loading Dose", type: "number", unit: "mg/kg", min: 15, max: 35, step: 1, section: "Loading Dose Policy", description: "ASHP/IDSA 2020: 25-30 mg/kg" },
  { key: "loading_dose_max_mg", label: "Loading Dose Cap", type: "number", unit: "mg", min: 2000, max: 4000, step: 250, section: "Loading Dose Policy" },

  // Dose Limits
  { key: "max_single_dose_mg", label: "Max Single Dose", type: "number", unit: "mg", min: 500, max: 4000, step: 250, section: "Dose Limits" },
  { key: "max_daily_dose_mg", label: "Max Daily Dose", type: "number", unit: "mg/day", min: 1000, max: 8000, step: 500, section: "Dose Limits" },

  // Display
  { key: "show_math_by_default", label: "Show PK Math by Default", type: "boolean", section: "Display Preferences" },
  { key: "default_graph_zoom_hours", label: "Default Graph Zoom", type: "number", unit: "hours", min: 24, max: 168, step: 12, section: "Display Preferences" },

  // Institution
  { key: "institution_name", label: "Institution Name", type: "text", section: "Institution", description: "Displayed in reports and documentation" },
  { key: "institution_protocol_url", label: "Protocol Link", type: "text", section: "Institution", description: "URL to your institution's vancomycin protocol" },
];

export default function InstitutionalSettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const { settings, institution, loading: settingsLoading, updateSettings } = useInstitutionalSettings();
  const [localSettings, setLocalSettings] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  if (authLoading || settingsLoading) {
    return <div style={{ padding: 40, textAlign: "center", color: "var(--color-dim)" }}>Loading...</div>;
  }

  if (!user) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <p style={{ color: "var(--color-secondary)" }}>Please <Link href="/login" style={{ color: "var(--color-primary)" }}>sign in</Link> to configure settings.</p>
      </div>
    );
  }

  const handleChange = (key: string, value: unknown) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    const result = await updateSettings(localSettings);
    setSaving(false);
    if (result.ok) {
      setMessage({ type: "success", text: "Settings saved successfully." });
    } else {
      setMessage({ type: "error", text: result.error ?? "Failed to save." });
    }
  };

  const sections = Array.from(new Set(FIELDS.map(f => f.section)));

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 16px 80px" }}>
      <div style={{ display: "flex", gap: 16, fontSize: 13, marginBottom: 16, flexWrap: "wrap" }}>
        <span style={{ color: "var(--color-primary)", fontWeight: 600 }}>Institutional Settings</span>
        <span style={{ color: "var(--color-border)" }}>·</span>
        <Link href="/settings/billing" style={{ color: "var(--color-dim)", textDecoration: "none" }}>
          Billing &amp; Subscription
        </Link>
        <span style={{ color: "var(--color-border)" }}>·</span>
        <Link href="/settings/history" style={{ color: "var(--color-dim)", textDecoration: "none" }}>
          Calculation History
        </Link>
      </div>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--color-primary)", marginBottom: 4 }}>
        Institutional Settings
      </h1>
      <p style={{ fontSize: 13, color: "var(--color-dim)", marginBottom: 16 }}>
        Clinical defaults for {institution || "your institution"}. Changes apply to all users at this institution.
      </p>

      {/* Student / resident discount — auto-verified school emails OR manual application */}
      <DiscountStatusCard />
      {/* Referral program — earn 1 month free Pro per Pro conversion */}
      <ReferralCard />
      {!user.institution && (
        <div style={{ padding: "10px 14px", marginBottom: 20, background: "#fffbeb", border: "1px solid #fcd34d", color: "#92400e", fontSize: 13 }}>
          No institution set in your profile. Settings will be saved as personal defaults. To share settings across your team, add your institution name during registration.
        </div>
      )}

      {message && (
        <div style={{
          padding: "10px 14px",
          marginBottom: 16,
          background: message.type === "success" ? "#ecfdf5" : "#fff5f5",
          border: `1px solid ${message.type === "success" ? "#6ee7b7" : "#fca5a5"}`,
          color: message.type === "success" ? "#047857" : "#991b1b",
          fontSize: 13,
        }}>
          {message.text}
        </div>
      )}

      {sections.map(section => (
        <div key={section} style={{ marginBottom: 24 }}>
          <h2 style={{
            fontSize: 12,
            fontWeight: 700,
            color: "var(--color-primary)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginBottom: 12,
            paddingBottom: 6,
            borderBottom: "1px solid var(--color-border)",
          }}>
            {section}
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {FIELDS.filter(f => f.section === section).map(field => {
              const val = (localSettings as unknown as Record<string, unknown>)[field.key];
              return (
                <div key={field.key} className="flex items-center justify-between gap-4" style={{ minHeight: 36 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 13, fontWeight: 500, color: "var(--color-secondary)" }}>
                      {field.label}
                    </label>
                    {field.description && (
                      <p style={{ fontSize: 11, color: "var(--color-dim)", margin: "2px 0 0" }}>{field.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2" style={{ flexShrink: 0 }}>
                    {field.type === "boolean" ? (
                      <button
                        type="button"
                        onClick={() => handleChange(field.key, !val)}
                        style={{
                          width: 48,
                          height: 26,
                          position: "relative",
                          background: val ? "var(--color-primary)" : "#e2e8f0",
                          border: "none",
                          cursor: "pointer",
                          borderRadius: 13,
                          transition: "background 0.15s",
                        }}
                      >
                        <span style={{
                          position: "absolute",
                          top: 3,
                          left: val ? 25 : 3,
                          width: 20,
                          height: 20,
                          background: "#ffffff",
                          borderRadius: 10,
                          transition: "left 0.15s",
                          boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
                        }} />
                      </button>
                    ) : field.type === "text" ? (
                      <input
                        type="text"
                        value={(val as string) ?? ""}
                        onChange={e => handleChange(field.key, e.target.value)}
                        style={{
                          width: 200,
                          padding: "6px 10px",
                          fontSize: 13,
                          border: "1px solid var(--color-border)",
                          background: "var(--color-input, #ffffff)",
                          color: "var(--color-primary)",
                        }}
                      />
                    ) : (
                      <>
                        <input
                          type="number"
                          value={(val as number) ?? 0}
                          onChange={e => handleChange(field.key, Number(e.target.value))}
                          min={field.min}
                          max={field.max}
                          step={field.step}
                          style={{
                            width: 90,
                            padding: "6px 10px",
                            fontSize: 13,
                            fontFamily: "var(--font-mono, monospace)",
                            fontWeight: 600,
                            textAlign: "right",
                            border: "1px solid var(--color-border)",
                            background: "var(--color-input, #ffffff)",
                            color: "var(--color-primary)",
                          }}
                        />
                        {field.unit && (
                          <span style={{ fontSize: 11, color: "var(--color-dim)", minWidth: 50 }}>{field.unit}</span>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <div style={{ display: "flex", gap: 12, marginTop: 24, paddingTop: 16, borderTop: "1px solid var(--color-border)" }}>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: "10px 24px",
            fontSize: 14,
            fontWeight: 600,
            background: "var(--color-primary)",
            color: "#ffffff",
            border: "none",
            cursor: saving ? "wait" : "pointer",
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>
        <button
          type="button"
          onClick={() => setLocalSettings(settings)}
          style={{
            padding: "10px 24px",
            fontSize: 14,
            fontWeight: 500,
            background: "var(--color-card, #ffffff)",
            color: "var(--color-secondary)",
            border: "1px solid var(--color-border)",
            cursor: "pointer",
          }}
        >
          Reset
        </button>
      </div>
    </div>
  );
}
