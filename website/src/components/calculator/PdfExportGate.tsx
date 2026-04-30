"use client";

import { useState, useCallback } from "react";
import { hasFeature } from "@/lib/tiers";
import UpgradeModal from "@/components/UpgradeModal";

interface PdfExportGateProps {
  tier: string;
  onExport: () => void;
}

export default function PdfExportGate({ tier, onExport }: PdfExportGateProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const allowed = hasFeature(tier, "export.pdf");

  const handleClick = useCallback(() => {
    if (allowed) {
      onExport();
    } else {
      setModalOpen(true);
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

      <UpgradeModal open={modalOpen} onClose={() => setModalOpen(false)} feature="export.pdf" />
    </div>
  );
}
