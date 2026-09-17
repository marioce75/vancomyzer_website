"use client";

import type { ReactNode } from "react";

export type AdvisorySeverity = "info" | "caution" | "warning" | "success";

const GLYPH: Record<AdvisorySeverity, string> = {
  info: "i",
  caution: "!",
  warning: "!!",
  success: "✓",
};

const SR_LABEL: Record<AdvisorySeverity, string> = {
  info: "Information",
  caution: "Caution",
  warning: "Warning",
  success: "OK",
};

interface AdvisoryProps {
  severity: AdvisorySeverity;
  /** Short, scannable headline — always visible. */
  title: string;
  /** One-line summary shown beside the title. */
  summary?: ReactNode;
  /** Longer content. When `collapsible`, it sits behind a native disclosure. */
  children?: ReactNode;
  /** Render the long content behind a <details> toggle (closed by default). */
  collapsible?: boolean;
  /** Right-aligned action (button/link). */
  action?: ReactNode;
  role?: "alert" | "status";
}

/**
 * Compact severity-coded advisory row. Severity is communicated by border
 * weight/colour, a glyph and a visually hidden label, so it never relies on
 * colour alone. Sits immediately under the recommendation band, next to the
 * decision it affects.
 */
export default function Advisory({ severity, title, summary, children, collapsible, action, role }: AdvisoryProps) {
  const glyph = (
    <span
      aria-hidden="true"
      className="inline-flex h-4 min-w-4 items-center justify-center px-1 text-[10px] font-black leading-none"
      style={{ border: "1px solid currentColor", borderRadius: 3, marginTop: 2 }}
    >
      {GLYPH[severity]}
    </span>
  );
  const head = (
    <>
      <span className="sr-only">{SR_LABEL[severity]}: </span>
      <span className="font-bold">{title}</span>
      {summary && <span className="ml-1.5">{summary}</span>}
    </>
  );

  if (collapsible && children) {
    return (
      <details className={`vz-advisory vz-advisory--${severity}`} role={role}>
        <summary className="vz-advisory-row">
          {glyph}
          <span className="min-w-0">
            {head}
            <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wider underline opacity-80">details</span>
          </span>
          <span className="shrink-0" onClick={(e) => e.stopPropagation()}>{action}</span>
        </summary>
        <div className="mt-1 pl-6 text-[11.5px] leading-5">{children}</div>
      </details>
    );
  }

  return (
    <div className={`vz-advisory vz-advisory--${severity}`} role={role}>
      <div className="vz-advisory-row">
        {glyph}
        <div className="min-w-0">
          {head}
          {children && <div className="mt-0.5 text-[11.5px] leading-5">{children}</div>}
        </div>
        <div className="shrink-0">{action}</div>
      </div>
    </div>
  );
}
