import type { ReactNode } from "react";

/**
 * Direction A page primitives for the marketing and reference pages.
 * Tokens follow src/contexts/MatrixSettingsContext (COLOR_PRESETS.basic) and the
 * ".vz-record" block in globals.css. The calculator keeps its own components.
 */
export const INK = "#14232f";
export const INK2 = "#4a5a68";
export const INK3 = "#546471";
export const RULE = "#cbd6e0";
export const ACTION = "#1f5e96";
export const FRAME = "#e6eef5";
export const PAPER = "#ffffff";

/** Page opener: kicker, serif title and a one-paragraph lede. */
export function PageHeader({
  kicker,
  title,
  lede,
  children,
  compact,
}: {
  kicker?: string;
  title: ReactNode;
  lede?: ReactNode;
  children?: ReactNode;
  compact?: boolean;
}) {
  return (
    <section className="mx-auto max-w-[1180px] px-4 sm:px-6" style={{ borderBottom: `1px solid ${RULE}` }}>
      <div className={compact ? "py-10 md:py-12" : "py-12 md:pb-14 md:pt-[64px]"}>
        {kicker && (
          <span className="mb-[14px] block text-[13px] font-semibold uppercase tracking-[0.12em]" style={{ color: INK3 }}>
            {kicker}
          </span>
        )}
        <h1
          className={`vz-serif max-w-[24ch] leading-[1.08] ${compact ? "text-[clamp(28px,3.4vw,40px)]" : "text-[clamp(32px,4vw,48px)]"}`}
          style={{ color: INK }}
        >
          {title}
        </h1>
        {lede && (
          <p className="mt-[18px] max-w-[62ch] text-lg leading-[1.5]" style={{ color: INK2 }}>
            {lede}
          </p>
        )}
        {children}
      </div>
    </section>
  );
}

/** One record row: a label column on the left, content on the right. */
export function Record({
  id,
  label,
  note,
  children,
  last,
  tight,
}: {
  id?: string;
  label: ReactNode;
  note?: ReactNode;
  children: ReactNode;
  last?: boolean;
  tight?: boolean;
}) {
  return (
    <section id={id} className="mx-auto max-w-[1180px] px-4 sm:px-6" style={{ borderBottom: last ? "none" : `1px solid ${RULE}` }}>
      <div className={`vz-record ${tight ? "py-8 md:py-10" : "py-10 md:py-14"}`}>
        <div>
          <span className="block text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: INK3 }}>
            {label}
          </span>
          {note && (
            <span className="mt-2 block text-[13px] leading-[1.45]" style={{ color: INK3 }}>
              {note}
            </span>
          )}
        </div>
        <div className="min-w-0">{children}</div>
      </div>
    </section>
  );
}

export function H2({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <h2 id={id} className="vz-serif text-[clamp(24px,2.6vw,32px)] leading-[1.15]" style={{ color: INK }}>
      {children}
    </h2>
  );
}

export function H3({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <h3 id={id} className="vz-serif text-[22px] leading-[1.25]" style={{ color: INK }}>
      {children}
    </h3>
  );
}

export function Prose({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`vz-prose max-w-[68ch] text-[16px] leading-[1.6] ${className}`} style={{ color: INK2 }}>
      {children}
    </div>
  );
}

export function Chip({ kind, children }: { kind: "ok" | "warn" | "crit"; children: ReactNode }) {
  return <span className={`vz-mchip vz-mchip--${kind}`}>{children}</span>;
}

/** Bordered white block for a table, a quote or an example. */
export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`border bg-white p-5 sm:p-6 ${className}`} style={{ borderColor: RULE, color: INK }}>
      {children}
    </div>
  );
}
