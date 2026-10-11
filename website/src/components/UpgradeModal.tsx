"use client";
import { LocalizedText } from "@/localization/LanguageProvider";

import { LocalizedButton } from "@/localization/LocalizedElements";


/** Availability notice. Feature permission checks remain in the caller. */

import { useEffect, useCallback } from "react";
import Link from "next/link";
import { type FeatureId } from "@/lib/tiers";

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  feature: FeatureId;
  /** Optional: short headline override; otherwise derived from feature id. */
  title?: string;
  /** Optional: longer description override. */
  description?: string;
}


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

  const headline = title ?? "Feature access";
  const body = description ?? "This feature is not available for your current account access. Contact us to discuss availability.";
  const primaryHref = "/contact?topic=restricted_access";
  const primaryLabel = "Request restricted access";
  const primaryExternal = false;
  void feature;

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
        <LocalizedButton
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
        </LocalizedButton>

        <h2 id="upgrade-modal-title" style={{ margin: "0 0 10px", fontSize: 18, fontWeight: 700, color: "#0f172a" }}>
          <LocalizedText text={headline} />
        </h2>

        <p style={{ margin: "0 0 16px", fontSize: 14, color: "#475569", lineHeight: 1.55 }}>
          <LocalizedText text={body} />
        </p>

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
          ><LocalizedText text={"No thanks"} /></button>
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
              <LocalizedText text={primaryLabel} />
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
              <LocalizedText text={primaryLabel} />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
