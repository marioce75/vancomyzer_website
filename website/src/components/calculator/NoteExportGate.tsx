"use client";
import { LocalizedText } from "@/localization/LanguageProvider";


import { useState, useCallback, useEffect, useRef } from "react";
import { hasFeature } from "@/lib/tiers";
import UpgradeModal from "@/components/UpgradeModal";

interface NoteExportGateProps {
  tier: string;
  disabled?: boolean;
  onCopy: () => void;
  noteText: string;
}

export default function NoteExportGate({ tier, disabled = false, onCopy, noteText: _noteText }: NoteExportGateProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const allowed = hasFeature(tier, "export.note.copy");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleClick = useCallback(() => {
    if (disabled) return;
    if (!allowed) {
      setModalOpen(true);
      return;
    }
    onCopy();
    setCopied(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), 2000);
  }, [allowed, onCopy, disabled]);

  // Clear pending timer if the button unmounts mid-flash to avoid setState-after-unmount.
  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        aria-live="polite"
        className="rounded px-4 py-2 text-xs font-bold uppercase tracking-wider transition"
        style={{
          background: copied ? "#047857" : "var(--color-primary)",
          color: "#ffffff",
          border: "none",
          cursor: "pointer",
          minWidth: 110,
        }}
      >
        <LocalizedText text={copied ? "Copied!" : "Copy Note"} />
      </button>

      <UpgradeModal open={modalOpen} onClose={() => setModalOpen(false)} feature="export.note.copy" />
    </div>
  );
}
