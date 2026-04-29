"use client";

import { useState, useEffect, useCallback } from "react";
import { hasFeature, upgradeTargetFor } from "@/lib/tiers";

interface NoteExportGateProps {
  tier: string;
  onCopy: () => void;
  noteText: string;
}

export default function NoteExportGate({ tier, onCopy, noteText }: NoteExportGateProps) {
  const [showMessage, setShowMessage] = useState(false);

  useEffect(() => {
    if (!showMessage) return;
    const timer = setTimeout(() => setShowMessage(false), 8000);
    return () => clearTimeout(timer);
  }, [showMessage]);

  const allowed = hasFeature(tier, "export.note.copy");
  const upgradeTier = upgradeTargetFor("export.note.copy");

  const handleClick = useCallback(() => {
    if (allowed) {
      onCopy();
    } else {
      setShowMessage(true);
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

      {showMessage && (
        <p
          className="mt-2 text-xs leading-relaxed"
          style={{ color: "var(--color-secondary)" }}
        >
          Clinical note export is available on {upgradeTier.name} and higher plans.
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
