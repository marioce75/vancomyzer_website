"use client";

import { useState, useCallback } from "react";
import { hasFeature } from "@/lib/tiers";
import UpgradeModal from "@/components/UpgradeModal";

interface NoteExportGateProps {
  tier: string;
  onCopy: () => void;
  noteText: string;
}

export default function NoteExportGate({ tier, onCopy, noteText }: NoteExportGateProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const allowed = hasFeature(tier, "export.note.copy");

  const handleClick = useCallback(() => {
    if (allowed) {
      onCopy();
    } else {
      setModalOpen(true);
    }
  }, [allowed, onCopy]);

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        className="rounded px-4 py-2 text-xs font-bold uppercase tracking-wider transition"
        style={{
          background: "var(--color-primary)",
          color: "#ffffff",
          border: "none",
          cursor: "pointer",
        }}
      >
        Copy Note
      </button>

      <UpgradeModal open={modalOpen} onClose={() => setModalOpen(false)} feature="export.note.copy" />
    </div>
  );
}
