"use client";

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
    <div
      role="region"
      aria-label="Upgrade prompt"
      style={{
        marginTop: 12,
        padding: "10px 14px",
        background: "#f0fdfa",
        border: "1px solid #99f6e4",
        borderLeft: "3px solid #0d9488",
        borderRadius: 4,
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
      }}
    >
      <div style={{ flex: 1, minWidth: 240 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#115e59", lineHeight: 1.4 }}>
          Remove the export watermark &amp; save calculation history.
        </p>
        <p style={{ margin: "2px 0 0", fontSize: 11, color: "#0f766e", lineHeight: 1.4 }}>
          Vancomyzer&trade; Individual Pro · 14-day free trial · $9.99/mo billed annually.
        </p>
      </div>
      <Link
        href="/settings/billing"
        style={{
          padding: "6px 14px",
          fontSize: 12,
          fontWeight: 700,
          background: "#0d9488",
          color: "#ffffff",
          textDecoration: "none",
          borderRadius: 4,
          whiteSpace: "nowrap",
        }}
      >
        Start trial →
      </Link>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss upgrade prompt"
        style={{
          background: "transparent",
          border: "none",
          color: "#0f766e",
          fontSize: 18,
          lineHeight: 1,
          cursor: "pointer",
          padding: "4px 8px",
        }}
      >
        ×
      </button>
    </div>
  );
}
