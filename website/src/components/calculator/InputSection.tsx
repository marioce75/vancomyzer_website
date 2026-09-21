"use client";

import { useEffect, useRef, type ReactNode } from "react";

interface InputSectionProps {
  id: string;
  title: string;
  /** True when the section's required inputs are present. */
  completed: boolean;
  /** Optional right-side hint (e.g. "required"). */
  hint?: ReactNode;
  /** When this matches `id`, the section scrolls into view (workflow hand-offs such as bedbound  levels). */
  focusSection?: string;
  children: ReactNode;
}

/**
 * Always-open input group for the clinical rail. Replaces the one-open-at-a-
 * time accordion: every field stays visible so the clinician never has to
 * reopen a section to check a value. A 28px header carries the completion
 * state as text + glyph (not colour alone).
 */
export default function InputSection({ id, title, completed, hint, focusSection, children }: InputSectionProps) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (focusSection === id) ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [focusSection, id]);

  return (
    <section ref={ref} id={`section-panel-${id}`} className="vz-section" aria-labelledby={`section-title-${id}`}>
      <header className="vz-section-head">
        <h2 id={`section-title-${id}`} className="m-0 text-[12px] font-bold uppercase tracking-[0.1em]" style={{ color: "#14232f" }}>
          {title}
        </h2>
        <span className="flex items-center gap-2">
          {hint}
          <span className={`vz-chip ${completed ? "vz-chip--ok" : "vz-chip--caution"}`}>
            {completed ? "ready" : "needs input"}
          </span>
        </span>
      </header>
      <div className="vz-section-body">{children}</div>
    </section>
  );
}
