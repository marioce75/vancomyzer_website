"use client";

import { useState, useEffect, useCallback } from "react";

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

  const isPaid = tier === "department" || tier === "hospital" || tier === "enterprise";

  const handleClick = useCallback(() => {
    if (isPaid) {
      onCopy();
    } else {
      setShowMessage(true);
    }
  }, [isPaid, onCopy]);

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
          Clinical note export is available on Department and Hospital plans.
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
