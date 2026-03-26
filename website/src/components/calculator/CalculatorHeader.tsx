import Link from "next/link";

type WorkspaceViewMode = "empiric" | "one_level" | "two_levels";

interface CalculatorHeaderProps {
  viewMode: WorkspaceViewMode;
  onViewModeChange: (mode: WorkspaceViewMode) => void;
}

export default function CalculatorHeader({ viewMode, onViewModeChange }: CalculatorHeaderProps) {
  return (
    <header
      className="shrink-0 border-b"
      style={{
        background: "#000000",
        borderBottomColor: "#003b00",
        boxShadow: "0 1px 0 rgba(0,255,65,0.2)",
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
              className="text-[15px] font-bold tracking-tight whitespace-nowrap leading-tight transition-colors"
              style={{ color: "#00ff41", fontFamily: "'Share Tech Mono', monospace", textShadow: "0 0 8px rgba(0,255,65,0.5)" }}
            >
              Vancomyzer<sup className="text-[8px] font-semibold ml-0.5 align-super" style={{ color: "#00a827" }}>™</sup>
            </h1>
            <p className="text-[10px] font-medium leading-none mt-0.5 whitespace-nowrap" style={{ color: "#1a5c1a", fontFamily: "'Share Tech Mono', monospace" }}>
              Bayesian PK · <span style={{ color: "#003b00" }}>engineered by</span>{" "}
              <span className="font-semibold tracking-wide" style={{ color: "#00a827" }}>Dōsys&trade;</span>
            </p>
          </div>

          {/* Clinical decision support badge — desktop only */}
          <span
            className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] whitespace-nowrap"
            style={{
              border: "1px solid rgba(0,255,65,0.4)",
              background: "rgba(0,255,65,0.05)",
              color: "#00a827",
              fontFamily: "'Share Tech Mono', monospace",
            }}
          >
            <span className="h-1.5 w-1.5 shrink-0 mx-blink" style={{ backgroundColor: "#00ff41", display: "inline-block" }} aria-hidden="true" />
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
              border: "1px solid rgba(0,255,65,0.4)",
              background: "#000000",
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
                        background: "#00ff41",
                        color: "#000000",
                        fontFamily: "'Share Tech Mono', monospace",
                        textShadow: "none",
                      }
                    : {
                        background: "transparent",
                        border: "1px solid #003b00",
                        color: "#1a5c1a",
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
            style={{ color: "#00a827", border: "1px solid transparent", fontFamily: "'Share Tech Mono', monospace" }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.borderColor = "rgba(0,255,65,0.4)";
              (e.currentTarget as HTMLElement).style.background = "#0a1a0a";
              (e.currentTarget as HTMLElement).style.color = "#00ff41";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.borderColor = "transparent";
              (e.currentTarget as HTMLElement).style.background = "transparent";
              (e.currentTarget as HTMLElement).style.color = "#00a827";
            }}
          >
            Home
          </Link>
          <Link
            href="/trust-evidence"
            className="px-3 py-1.5 text-sm font-medium transition"
            style={{ color: "#00a827", border: "1px solid transparent", fontFamily: "'Share Tech Mono', monospace" }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.borderColor = "rgba(0,255,65,0.4)";
              (e.currentTarget as HTMLElement).style.background = "#0a1a0a";
              (e.currentTarget as HTMLElement).style.color = "#00ff41";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.borderColor = "transparent";
              (e.currentTarget as HTMLElement).style.background = "transparent";
              (e.currentTarget as HTMLElement).style.color = "#00a827";
            }}
          >
            Methods
          </Link>
        </div>

      </div>
    </header>
  );
}
