"use client";

/**
 * Teaching Mode inline expandable note.
 *
 * Renders only when `teachingMode` is true in MatrixSettingsContext.
 * The note appears as a small "▼ Why?" pill that expands to plain-language
 * PK explanations adjacent to result sections in the calculator workspace.
 *
 * Goal: turn Vancomyzer from a pure calculator into a transparent teaching
 * tool — answers "what is the engine doing and why?" inline, rather than
 * forcing the clinician to navigate elsewhere.
 */

import { useState } from "react";
import { useMatrixSettings } from "@/contexts/MatrixSettingsContext";

interface TeachingNoteProps {
  label?: string;
  children: React.ReactNode;
}

export default function TeachingNote({ label = "Why?", children }: TeachingNoteProps) {
  const { settings } = useMatrixSettings();
  const [open, setOpen] = useState(false);

  if (!settings.teachingMode) return null;

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider transition"
        style={{
          background: open ? "#dbeafe" : "#eff6ff",
          color: "#1e40af",
          border: "1px solid #bfdbfe",
          borderRadius: 4,
          cursor: "pointer",
          letterSpacing: "0.06em",
        }}
        aria-expanded={open}
      >
        <span style={{ display: "inline-block", transform: open ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s" }}>▶</span>
        {label}
      </button>
      {open && (
        <div
          className="mt-2 px-3 py-2 text-xs leading-relaxed"
          style={{
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            borderLeftWidth: 3,
            color: "#1e3a8a",
            borderRadius: 4,
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
