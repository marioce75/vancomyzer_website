"use client";

import { useState, useEffect, useCallback } from "react";
import { hasFeature, upgradeTargetFor } from "@/lib/tiers";

interface PdfExportGateProps {
  tier: string;
  onExport: () => void;
}

export default function PdfExportGate({ tier, onExport }: PdfExportGateProps) {
  const [showMessage, setShowMessage] = useState(false);

  useEffect(() => {
    if (!showMessage) return;
    const timer = setTimeout(() => setShowMessage(false), 8000);
    return () => clearTimeout(timer);
  }, [showMessage]);

  const allowed = hasFeature(tier, "export.pdf");
  const upgradeTier = upgradeTargetFor("export.pdf");

  const handleClick = useCallback(() => {
    if (allowed) {
      onExport();
    } else {
      setShowMessage(true);
    }
  }, [allowed, onExport]);

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        className="border px-2 py-0.5 text-[10px] font-semibold transition-colors"
        style={{ borderColor: "var(--color-border)", background: "transparent", color: "var(--color-secondary)" }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.background = "var(--color-primary)";
          (e.currentTarget as HTMLElement).style.color = "var(--color-card, #fff)";
          (e.currentTarget as HTMLElement).style.borderColor = "var(--color-primary)";
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.background = "transparent";
          (e.currentTarget as HTMLElement).style.color = "var(--color-secondary)";
          (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border)";
        }}
      >
        EXPORT PDF
      </button>

      {showMessage && (
        <p
          className="mt-2 text-xs leading-relaxed"
          style={{ color: "var(--color-secondary)" }}
        >
          PDF export is available on {upgradeTier.name} and higher plans.
          Contact{" "}
          <a
            href="mailto:info@dosys.health"
            style={{ color: "#0d9488", textDecoration: "underline" }}
          >
            info@dosys.health
          </a>
        </p>
      )}
    </div>
  );
}
