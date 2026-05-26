"use client";

/**
 * Upgrade modal shown when a Free user attempts a Pro+ feature.
 *
 * Two CTAs per spec: "Start 14-day trial" (primary) and "No thanks"
 * (secondary, closes modal). Routes to /settings/billing where the
 * trial actually starts. No dark patterns — × close in the corner,
 * Esc-to-close, click-outside-to-close.
 *
 * Usage:
 *   const [open, setOpen] = useState(false);
 *   <button onClick={() => !canSaveHistory && setOpen(true)}>...</button>
 *   <UpgradeModal
 *     open={open}
 *     onClose={() => setOpen(false)}
 *     feature="history.calculation"
 *   />
 */

import { useEffect, useCallback } from "react";
import Link from "next/link";
import { upgradeTargetFor, type FeatureId } from "@/lib/tiers";

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  feature: FeatureId;
  /** Optional: short headline override; otherwise derived from feature id. */
  title?: string;
  /** Optional: longer description override. */
  description?: string;
}

const DEFAULT_COPY: Partial<Record<FeatureId, { title: string; description: string }>> = {
  "export.pdf": {
    title: "PDF export is a Pro feature",
    description:
      "Export branded clinical-note PDFs of your calculations for the medical record. Available on Individual Pro and higher.",
  },
  "export.note.copy": {
    title: "Clinical note export is a Pro feature",
    description:
      "Copy a clinician-ready note to your clipboard for paste into the EHR. Available on Individual Pro and higher.",
  },
  "export.note.unwatermarked": {
    title: "Clinical-note export is a Pro feature",
    description:
      "Pro unlocks branded PDF and note export for the medical record — Free tier is calculator-only.",
  },
  "history.calculation": {
    title: "Calculation history is a Pro feature",
    description:
      "Save 90 days of de-identified calculation history with optional case IDs. Search past calcs without re-entering patient data.",
  },
  "org.admin_panel": {
    title: "Team management is a Department feature",
    description:
      "Invite teammates, manage roles, and view your institution's calculation audit log. Available on Department and Hospital plans.",
  },
  "org.invite_users": {
    title: "Invitations are a Department feature",
    description:
      "Add teammates to your shared workspace. Available on Department and Hospital plans.",
  },
};

export default function UpgradeModal({ open, onClose, feature, title, description }: UpgradeModalProps) {
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [open, handleEscape]);

  if (!open) return null;

  const upgradeTier = upgradeTargetFor(feature);
  const copy = DEFAULT_COPY[feature] ?? {
    title: `${upgradeTier.name} plan required`,
    description: `This feature is available on ${upgradeTier.name} and higher plans.`,
  };
  const headline = title ?? copy.title;
  const body = description ?? copy.description;

  // Department / Hospital CTAs go to dosys.health/contact (sales).
  // Individual Pro CTA goes to /settings/billing (self-serve checkout).
  const isSelfServe = upgradeTier.id === "individual_pro";
  const primaryHref = isSelfServe ? "/settings/billing" : upgradeTier.cta.href;
  const primaryLabel = isSelfServe ? "Start 14-day trial" : upgradeTier.cta.label;
  const primaryExternal = !isSelfServe;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-modal-title"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.55)",
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "#ffffff",
          borderRadius: 8,
          boxShadow: "0 12px 40px rgba(0, 0, 0, 0.25)",
          maxWidth: 440,
          width: "100%",
          padding: 24,
          position: "relative",
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            background: "transparent",
            border: "none",
            color: "#94a3b8",
            fontSize: 20,
            lineHeight: 1,
            cursor: "pointer",
            padding: 6,
          }}
        >
          ×
        </button>

        <div style={{ fontSize: 11, fontWeight: 700, color: "#0d9488", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>
          Upgrade to {upgradeTier.name}
        </div>

        <h2 id="upgrade-modal-title" style={{ margin: "0 0 10px", fontSize: 18, fontWeight: 700, color: "#0f172a" }}>
          {headline}
        </h2>

        <p style={{ margin: "0 0 16px", fontSize: 14, color: "#475569", lineHeight: 1.55 }}>
          {body}
        </p>

        <div style={{
          padding: 12,
          background: "#f8fafc",
          border: "1px solid #e2e8f0",
          borderRadius: 4,
          marginBottom: 20,
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#0f172a", marginBottom: 4 }}>
            {upgradeTier.priceLabel}
          </div>
          <div style={{ fontSize: 11, color: "#64748b" }}>
            {upgradeTier.audience}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "9px 16px",
              fontSize: 13,
              fontWeight: 500,
              background: "transparent",
              color: "#64748b",
              border: "1px solid #cbd5e1",
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            No thanks
          </button>
          {primaryExternal ? (
            <a
              href={primaryHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onClose}
              style={{
                padding: "9px 16px",
                fontSize: 13,
                fontWeight: 600,
                background: "#0d9488",
                color: "#ffffff",
                border: "none",
                borderRadius: 4,
                textDecoration: "none",
              }}
            >
              {primaryLabel}
            </a>
          ) : (
            <Link
              href={primaryHref}
              onClick={onClose}
              style={{
                padding: "9px 16px",
                fontSize: 13,
                fontWeight: 600,
                background: "#0d9488",
                color: "#ffffff",
                border: "none",
                borderRadius: 4,
                textDecoration: "none",
              }}
            >
              {primaryLabel}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
