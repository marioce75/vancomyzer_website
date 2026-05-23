"use client";

/**
 * Backfill prompt for users who signed up before the structured
 * categorization fields (country, institution_type, practice_setting)
 * became required.
 *
 * Pattern: lightweight banner pinned to the top of every signed-in
 * page. Expands into a modal-style form when the user clicks "Complete
 * profile." Submission POSTs to /api/profile/categorization. Once
 * complete (or dismissed), it stays out of the way for the session via
 * sessionStorage.
 *
 * Does NOT block any functionality — calculator + everything else works
 * regardless of whether the profile is filled. Users can keep dismissing
 * if they want. The intent is gentle social pressure, not friction.
 */

import { useEffect, useState } from "react";
import { COUNTRIES, INSTITUTION_TYPES, PRACTICE_SETTINGS } from "@/lib/userCategorization";
import { useAuth } from "@/contexts/AuthContext";

const DISMISSAL_KEY = "vancomyzer:profile-prompt-dismissed";

export default function ProfileCompletionPrompt() {
  const { user, loading: authLoading } = useAuth();
  const [needsCompletion, setNeedsCompletion] = useState<boolean | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [countryCode, setCountryCode] = useState("");
  const [institutionType, setInstitutionType] = useState("");
  const [practiceSetting, setPracticeSetting] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [dismissed, setDismissed] = useState(false);

  // Check on auth load
  useEffect(() => {
    if (authLoading || !user) {
      setNeedsCompletion(null);
      return;
    }
    if (typeof sessionStorage !== "undefined" && sessionStorage.getItem(DISMISSAL_KEY) === "1") {
      setDismissed(true);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/profile/categorization");
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!cancelled) {
          setNeedsCompletion(!data.complete);
          // Pre-fill any partial values
          if (data.country_code) setCountryCode(data.country_code);
          if (data.institution_type) setInstitutionType(data.institution_type);
          if (data.practice_setting) setPracticeSetting(data.practice_setting);
        }
      } catch {
        /* network glitch — don't pester */
      }
    })();
    return () => { cancelled = true; };
  }, [user, authLoading]);

  const handleDismiss = () => {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(DISMISSAL_KEY, "1");
    }
    setDismissed(true);
    setExpanded(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!countryCode || !institutionType || !practiceSetting) {
      setMsg({ type: "err", text: "All three fields are required." });
      return;
    }
    setSubmitting(true);
    setMsg(null);
    try {
      const res = await fetch("/api/profile/categorization", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          country_code: countryCode,
          institution_type: institutionType,
          practice_setting: practiceSetting,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setMsg({ type: "err", text: body.error ?? "Save failed." });
        return;
      }
      setMsg({ type: "ok", text: "Thanks — profile saved." });
      setNeedsCompletion(false);
      // Collapse after a short delay so the success message is visible
      setTimeout(() => { setExpanded(false); }, 1200);
    } catch {
      setMsg({ type: "err", text: "Network error." });
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || !user || dismissed || needsCompletion !== true) return null;

  return (
    <div
      role="region"
      aria-label="Complete your profile"
      style={{
        background: "#eff6ff",
        borderBottom: "1px solid #bfdbfe",
        color: "#1e3a8a",
        fontSize: 13,
      }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "10px 16px" }}>
        {!expanded ? (
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: 14 }}>👋</span>
            <span style={{ flex: 1, minWidth: 200 }}>
              <strong>Complete your profile</strong> — tell us your country, institution type, and
              practice setting so we can serve your context better. Takes 10 seconds.
            </span>
            <button
              type="button"
              onClick={() => setExpanded(true)}
              style={{
                padding: "6px 14px",
                fontSize: 12,
                fontWeight: 600,
                background: "#1e3a8a",
                color: "#fff",
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
              }}
            >
              Complete now
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              aria-label="Dismiss for this session"
              style={{
                padding: "6px 10px",
                fontSize: 12,
                background: "transparent",
                color: "#1e3a8a",
                border: "1px solid #bfdbfe",
                borderRadius: 4,
                cursor: "pointer",
              }}
            >
              Later
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 10, alignItems: "end" }}>
              <div>
                <label style={labelStyle}>Country</label>
                <select value={countryCode} onChange={e => setCountryCode(e.target.value)} required style={selectStyle}>
                  <option value="">— Select —</option>
                  {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Institution type</label>
                <select value={institutionType} onChange={e => setInstitutionType(e.target.value)} required style={selectStyle}>
                  <option value="">— Select —</option>
                  {INSTITUTION_TYPES.map(t => <option key={t.code} value={t.code}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Practice setting</label>
                <select value={practiceSetting} onChange={e => setPracticeSetting(e.target.value)} required style={selectStyle}>
                  <option value="">— Select —</option>
                  {PRACTICE_SETTINGS.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
                </select>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: "7px 14px",
                    fontSize: 12,
                    fontWeight: 600,
                    background: submitting ? "#94a3b8" : "#1e3a8a",
                    color: "#fff",
                    border: "none",
                    borderRadius: 4,
                    cursor: submitting ? "wait" : "pointer",
                  }}
                >
                  {submitting ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={handleDismiss}
                  style={{
                    padding: "7px 10px",
                    fontSize: 12,
                    background: "transparent",
                    color: "#1e3a8a",
                    border: "1px solid #bfdbfe",
                    borderRadius: 4,
                    cursor: "pointer",
                  }}
                >
                  Later
                </button>
              </div>
            </div>
            {msg && (
              <p style={{ marginTop: 6, marginBottom: 0, fontSize: 11, color: msg.type === "ok" ? "#047857" : "#b91c1c" }}>
                {msg.text}
              </p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 10,
  fontWeight: 600,
  color: "#1e3a8a",
  marginBottom: 3,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const selectStyle: React.CSSProperties = {
  width: "100%",
  padding: "6px 8px",
  fontSize: 12,
  border: "1px solid #bfdbfe",
  background: "#ffffff",
  color: "#1e3a8a",
  borderRadius: 4,
};
