'use client'

import Link from "next/link";
type WorkspaceViewMode = "empiric" | "one_level" | "two_levels";

interface CalculatorHeaderProps {
  viewMode: WorkspaceViewMode;
  onViewModeChange: (mode: WorkspaceViewMode) => void;
  onSettingsOpen?: () => void;
  userName?: string | null;
  userRole?: string | null;
  onLogout?: () => void;
}

export default function CalculatorHeader({ viewMode, onViewModeChange, onSettingsOpen, userName, userRole, onLogout }: CalculatorHeaderProps) {
  const logoSrc = "/logo-signal.svg";
  return (
    <header
      className="shrink-0 border-b"
      style={{
        background: "var(--color-nav-bg, var(--color-bg))",
        borderBottomColor: "var(--color-nav-border, var(--color-border))",
        boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
      }}
    >
      <div className="flex h-12 sm:h-14 lg:h-[68px] items-center justify-between gap-2 sm:gap-4 lg:gap-6 pl-2 pr-3 sm:pr-5 lg:pr-8">

        {/* ── Brand ──────────────────────────────────────── */}
        <Link href="/" className="flex items-center gap-2 sm:gap-3 shrink-0 group" style={{ textDecoration: "none" }}>
          <div className="min-w-0 hidden sm:block">
            <h1
              className="font-bold whitespace-nowrap leading-tight transition-colors vancomyzer-title"
              style={{ fontSize: "22px", letterSpacing: "4px", color: "var(--color-primary)", textShadow: "0 0 10px var(--color-glow)" }}
            >
              VANCOMYZER{"\u2122"}
            </h1>
            <p className="font-medium leading-none mt-0.5 whitespace-nowrap hidden lg:block" style={{ fontSize: "12px", letterSpacing: "2px", color: "var(--color-secondary)" }}>
              BAYESIAN PK ·{" "}
              <span style={{ fontSize: "11px", letterSpacing: "3px", color: "var(--color-dim)" }}>
                ENGINEERED BY{" "}
                <button
                  type="button"
                  aria-label="Visit dosys.health"
                  className="dosys-brand"
                  style={{ background: "transparent", border: "none", padding: 0, color: "inherit", textDecoration: "none", letterSpacing: "0px", textTransform: "none" as const, cursor: "pointer", fontFamily: "'Inter', 'Helvetica Neue', sans-serif", fontWeight: 700, fontSize: "12px" }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.opacity = "0.8";
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.opacity = "1";
                  }}
                  onClick={e => {
                    // Stop propagation so the parent <Link href="/"> doesn't fire
                    e.stopPropagation();
                    e.preventDefault();
                    window.open("https://dosys.health", "_blank", "noopener,noreferrer");
                  }}
                >
                  <span style={{ fontWeight: 700 }}>D<span className="dosys-d" style={{ color: "#00c9b1" }}>{"\u014D"}</span>sys</span><sup style={{ fontSize: "7px", verticalAlign: "super", marginLeft: "1px" }}>{"\u2122"}</sup>
                </button>
              </span>
            </p>
          </div>
        </Link>

        {/* Clinical decision support badge — desktop only */}
        <span
          className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] whitespace-nowrap shrink-0"
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
                className="px-2.5 sm:px-4 py-1.5 text-xs sm:text-sm font-semibold transition-all"
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
        <div className="hidden md:flex flex-1 items-center justify-end gap-2">
          <Link
            href="/"
            className="px-3 py-1.5 text-sm font-medium transition"
            style={{ color: "var(--color-secondary)", border: "1px solid transparent", fontFamily: "'Share Tech Mono', monospace" }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.borderColor = "var(--color-primary-a40)";
              (e.currentTarget as HTMLElement).style.background = "var(--color-primary)";
              (e.currentTarget as HTMLElement).style.color = "var(--color-card, #1a202c)";
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
            href="/faq"
            className="px-3 py-1.5 text-sm font-medium transition"
            style={{ color: "var(--color-secondary)", border: "1px solid transparent", fontFamily: "'Share Tech Mono', monospace" }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.borderColor = "var(--color-primary-a40)";
              (e.currentTarget as HTMLElement).style.background = "var(--color-primary)";
              (e.currentTarget as HTMLElement).style.color = "var(--color-card, #1a202c)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.borderColor = "transparent";
              (e.currentTarget as HTMLElement).style.background = "transparent";
              (e.currentTarget as HTMLElement).style.color = "var(--color-secondary)";
            }}
          >
            FAQ
          </Link>
          <Link
            href="/transparent-dosing"
            className="px-3 py-1.5 text-sm font-medium transition"
            style={{ color: "var(--color-secondary)", border: "1px solid transparent", fontFamily: "'Share Tech Mono', monospace" }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.borderColor = "var(--color-primary-a40)";
              (e.currentTarget as HTMLElement).style.background = "var(--color-primary)";
              (e.currentTarget as HTMLElement).style.color = "var(--color-card, #1a202c)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.borderColor = "transparent";
              (e.currentTarget as HTMLElement).style.background = "transparent";
              (e.currentTarget as HTMLElement).style.color = "var(--color-secondary)";
            }}
          >
            Transparency
          </Link>
          {userRole === "admin" && (
            <Link
              href="/admin/dashboard"
              className="px-3 py-1.5 text-sm font-medium transition"
              style={{ color: "var(--color-secondary)", border: "1px solid transparent", fontFamily: "'Share Tech Mono', monospace", fontWeight: 700 }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.borderColor = "var(--color-primary-a40)";
                (e.currentTarget as HTMLElement).style.background = "var(--color-primary)";
                (e.currentTarget as HTMLElement).style.color = "var(--color-card, #1a202c)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.borderColor = "transparent";
                (e.currentTarget as HTMLElement).style.background = "transparent";
                (e.currentTarget as HTMLElement).style.color = "var(--color-secondary)";
              }}
            >
              Dashboard
            </Link>
          )}
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
                (e.currentTarget as HTMLElement).style.background = "var(--color-primary)";
                (e.currentTarget as HTMLElement).style.color = "var(--color-card, #1a202c)";
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
          {userName && (
            <span className="ml-2 text-[11px] font-medium" style={{ color: "var(--color-dim)" }}>
              {userName}
            </span>
          )}
          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="ml-1 px-2 py-1 text-[11px] font-semibold transition"
              style={{
                color: "var(--color-secondary)",
                border: "1px solid var(--color-border)",
                background: "transparent",
                cursor: "pointer",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = "#991b1b";
                (e.currentTarget as HTMLElement).style.borderColor = "#991b1b";
                (e.currentTarget as HTMLElement).style.color = "#ffffff";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = "transparent";
                (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border)";
                (e.currentTarget as HTMLElement).style.color = "var(--color-secondary)";
              }}
            >
              LOGOUT
            </button>
          )}
        </div>

        {/* ── Mobile actions (visible when nav is hidden) ─── */}
        <div className="flex md:hidden items-center gap-1">
          {userRole === "admin" && (
            <Link
              href="/admin/dashboard"
              className="px-2 py-1.5 text-[10px] font-semibold"
              style={{ color: "var(--color-secondary)", border: "1px solid var(--color-primary-a40)", background: "transparent", textDecoration: "none" }}
            >
              DASHBOARD
            </Link>
          )}
          {onLogout && (
            <button type="button" onClick={onLogout}
              className="px-2 py-1.5 text-[10px] font-semibold"
              style={{ color: "var(--color-secondary)", border: "1px solid var(--color-border)", background: "transparent", cursor: "pointer" }}
            >
              LOGOUT
            </button>
          )}
        </div>

      </div>
    </header>
  );
}
