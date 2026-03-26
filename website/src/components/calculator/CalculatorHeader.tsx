import Link from "next/link";

type WorkspaceViewMode = "empiric" | "one_level" | "two_levels";

interface CalculatorHeaderProps {
  viewMode: WorkspaceViewMode;
  onViewModeChange: (mode: WorkspaceViewMode) => void;
  onSettingsOpen?: () => void;
}

export default function CalculatorHeader({ viewMode, onViewModeChange, onSettingsOpen }: CalculatorHeaderProps) {
  return (
    <header
      className="shrink-0 border-b"
      style={{
        background: "var(--color-bg)",
        borderBottomColor: "var(--color-border)",
        boxShadow: "0 1px 0 var(--color-primary-a20)",
      }}
    >
      <div className="mx-auto flex h-[68px] max-w-[1680px] items-center justify-between gap-6 px-5 lg:px-8">

        {/* ── Brand ──────────────────────────────────────── */}
        <Link href="/" className="flex items-center gap-3 min-w-0 flex-1 group">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/vancomyzer-logo.svg"
            alt="Vancomyzer™"
            width={36}
            height={36}
            className="shrink-0 transition-opacity group-hover:opacity-85"
            style={{ filter: "invert(1) sepia(1) saturate(3) hue-rotate(80deg)" }}
          />
          <div className="min-w-0">
            <h1
              className="font-bold whitespace-nowrap leading-tight transition-colors"
              style={{ fontSize: "22px", letterSpacing: "4px", color: "var(--color-primary)", fontFamily: "'Share Tech Mono', monospace", textShadow: "0 0 10px var(--color-glow)" }}
            >
              VANCOMYZER<sup className="text-[9px] font-semibold ml-1 align-super" style={{ color: "var(--color-secondary)" }}>{"\u2122"}</sup>
            </h1>
            <p className="text-[10px] font-medium leading-none mt-0.5 whitespace-nowrap" style={{ color: "var(--color-dim)", fontFamily: "'Share Tech Mono', monospace" }}>
              Bayesian PK · <span style={{ color: "var(--color-border)" }}>engineered by</span>{" "}
              <span className="font-semibold tracking-wide" style={{ color: "var(--color-secondary)" }}>Dōsys&trade;</span>
            </p>
          </div>

          {/* Clinical decision support badge — desktop only */}
          <span
            className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] whitespace-nowrap"
            style={{
              border: "1px solid var(--color-primary-a40)",
              background: "var(--color-primary-a05)",
              color: "var(--color-secondary)",
              fontFamily: "'Share Tech Mono', monospace",
            }}
          >
            <span className="h-1.5 w-1.5 shrink-0 mx-blink" style={{ backgroundColor: "var(--color-primary)", display: "inline-block" }} aria-hidden="true" />
            CLINICAL DECISION SUPPORT
          </span>
        </Link>

        {/* ── Mode switcher ──────────────────────────────── */}
        <div className="flex flex-1 items-center justify-center">
          <div
            className="flex p-0.5"
            role="tablist"
            aria-label="Calculation mode"
            style={{
              border: "1px solid var(--color-primary-a40)",
              background: "var(--color-bg)",
            }}
          >
            {([
              ["empiric",    "Empiric"],
              ["one_level",  "1 Level"],
              ["two_levels", "2 Levels"],
            ] as const).map(([value, title]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={viewMode === value}
                onClick={() => onViewModeChange(value)}
                className="px-4 py-1.5 text-sm font-semibold transition-all"
                style={
                  viewMode === value
                    ? {
                        background: "var(--color-primary)",
                        color: "var(--color-bg)",
                        fontFamily: "'Share Tech Mono', monospace",
                        textShadow: "none",
                      }
                    : {
                        background: "transparent",
                        border: "1px solid var(--color-border)",
                        color: "var(--color-dim)",
                        fontFamily: "'Share Tech Mono', monospace",
                      }
                }
              >
                {title}
              </button>
            ))}
          </div>
        </div>

        {/* ── Nav ───────────────────────────────────────── */}
        <div className="flex flex-1 items-center justify-end gap-2">
          <Link
            href="/"
            className="px-3 py-1.5 text-sm font-medium transition"
            style={{ color: "var(--color-secondary)", border: "1px solid transparent", fontFamily: "'Share Tech Mono', monospace" }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.borderColor = "var(--color-primary-a40)";
              (e.currentTarget as HTMLElement).style.background = "var(--color-highlight)";
              (e.currentTarget as HTMLElement).style.color = "var(--color-primary)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.borderColor = "transparent";
              (e.currentTarget as HTMLElement).style.background = "transparent";
              (e.currentTarget as HTMLElement).style.color = "var(--color-secondary)";
            }}
          >
            Home
          </Link>
          <Link
            href="/trust-evidence"
            className="px-3 py-1.5 text-sm font-medium transition"
            style={{ color: "var(--color-secondary)", border: "1px solid transparent", fontFamily: "'Share Tech Mono', monospace" }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.borderColor = "var(--color-primary-a40)";
              (e.currentTarget as HTMLElement).style.background = "var(--color-highlight)";
              (e.currentTarget as HTMLElement).style.color = "var(--color-primary)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.borderColor = "transparent";
              (e.currentTarget as HTMLElement).style.background = "transparent";
              (e.currentTarget as HTMLElement).style.color = "var(--color-secondary)";
            }}
          >
            Methods
          </Link>
          {onSettingsOpen && (
            <button
              type="button"
              onClick={onSettingsOpen}
              className="ml-1 p-2 transition"
              style={{
                color: "var(--color-secondary)",
                border: "1px solid transparent",
                fontFamily: "'Share Tech Mono', monospace",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.borderColor = "var(--color-primary-a40)";
                (e.currentTarget as HTMLElement).style.background = "var(--color-highlight)";
                (e.currentTarget as HTMLElement).style.color = "var(--color-primary)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.borderColor = "transparent";
                (e.currentTarget as HTMLElement).style.background = "transparent";
                (e.currentTarget as HTMLElement).style.color = "var(--color-secondary)";
              }}
              aria-label="Terminal settings"
              title="Terminal settings"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
          )}
        </div>

      </div>
    </header>
  );
}
