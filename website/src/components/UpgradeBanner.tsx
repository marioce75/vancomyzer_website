"use client";
import { LocalizedText } from "@/localization/LanguageProvider";

import { LocalizedDiv, LocalizedButton } from "@/localization/LocalizedElements";


/**
 * Post-calculation upgrade prompt for Free users.
 *
 * Appears under the calculation result; small, dismissible (per session),
 * non-intrusive. Hidden entirely for Pro+ users.
 *
 * UX rules from spec:
 *   - No dark patterns. The dismiss action sticks for the session.
 *   - Calculator stays fully functional regardless of dismiss state.
 *   - Brand-cohesive (uses --color-primary palette).
 *   - Routes to in-app /pricing (which then drives Stripe checkout
 *     via /settings/billing) — single source of truth for pricing.
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import { useFeature } from "@/hooks/useFeature";

const STORAGE_KEY = "vmz_upgrade_banner_dismissed";

export default function UpgradeBanner() {
  const { allowed: isPaid } = useFeature("export.note.unwatermarked");
  const [dismissed, setDismissed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
    try {
      if (sessionStorage.getItem(STORAGE_KEY) === "1") setDismissed(true);
    } catch { /* sessionStorage unavailable — show banner */ }
  }, []);

  if (isPaid || dismissed || !hydrated) return null;

  const handleDismiss = () => {
    setDismissed(true);
    try { sessionStorage.setItem(STORAGE_KEY, "1"); } catch { /* ignore */ }
  };

  return (
    <LocalizedDiv
      role="region"
      aria-label="Upgrade prompt"
      style={{
        marginTop: 12,
        padding: "10px 14px",
        background: "#edf2f6",
        border: "1px solid #d7dfe5",
        borderLeft: "3px solid #355c7d",
        borderRadius: 4,
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
      }}
    >
      <div style={{ flex: 1, minWidth: 240 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#294b68", lineHeight: 1.4 }}><LocalizedText text={"Export clinical notes for the chart & save calculation history."} /></p>
        <p style={{ margin: "2px 0 0", fontSize: 11, color: "#355c7d", lineHeight: 1.4 }}><LocalizedText text={"Vancomyzer™ Individual Pro · 14-day free trial · $49.99/year."} /></p>
      </div>
      <Link
        href="/settings/billing"
        style={{
          padding: "6px 14px",
          fontSize: 12,
          fontWeight: 700,
          background: "#355c7d",
          color: "#ffffff",
          textDecoration: "none",
          borderRadius: 4,
          whiteSpace: "nowrap",
        }}
      ><LocalizedText text={"Start trial"} /></Link>
      <LocalizedButton
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss upgrade prompt"
        style={{
          background: "transparent",
          border: "none",
          color: "#355c7d",
          fontSize: 18,
          lineHeight: 1,
          cursor: "pointer",
          padding: "4px 8px",
        }}
      >
        ×
      </LocalizedButton>
    </LocalizedDiv>
  );
}
