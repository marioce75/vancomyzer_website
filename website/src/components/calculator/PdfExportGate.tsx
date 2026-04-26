"use client";

import { useState, useEffect, useCallback } from "react";

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

  const isPaid = tier === "department" || tier === "hospital" || tier === "enterprise";

  const handleClick = useCallback(() => {
    if (isPaid) {
      onExport();
    } else {
      setShowMessage(true);
    }
  }, [isPaid, onExport]);

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
          PDF export is available on Department and Hospital plans.
          Contact{" "}
          <a
            href="mailto:contact@vancomyzer.com"
            style={{ color: "#0d9488", textDecoration: "underline" }}
          >
            contact@vancomyzer.com
          </a>
        </p>
      )}
    </div>
  );
}
