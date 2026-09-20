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
  /**
   * Show a SIGN IN link in the slot LOGOUT normally occupies. The workspace
   * sets this only after the session check has finished and nobody is
   * signed in (open-access visitors), so it never flashes for account holders.
   */
  showSignIn?: boolean;
}

export default function CalculatorHeader({ viewMode, onViewModeChange, onSettingsOpen, userName, userRole, onLogout, showSignIn }: CalculatorHeaderProps) {
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
      <div className="flex h-12 items-center justify-between gap-2 sm:gap-4 pl-3 pr-3 sm:pr-4" style={{ height: "var(--vz-header-h, 48px)" }}>

        {/* ── Brand ──────────────────────────────────────── */}
        <Link href="/" className="flex items-center gap-2 sm:gap-3 shrink-0 group" style={{ textDecoration: "none" }} aria-label="Vancomyzer home">
          <span className="sm:hidden font-bold vancomyzer-title" style={{ fontSize: 16, letterSpacing: "2px", color: "var(--color-primary)" }}>VZ</span>
          <div className="min-w-0 hidden sm:flex items-baseline gap-3">
            <h1
              className="font-bold whitespace-nowrap leading-none transition-colors vancomyzer-title"
              style={{ fontSize: "18px", letterSpacing: "3px", color: "var(--color-primary)", textShadow: "0 0 10px var(--color-glow)" }}
            >
              VANCOMYZER{"\u2122"}
            </h1>
            <p className="font-medium leading-none whitespace-nowrap hidden xl:block" style={{ fontSize: "10px", letterSpacing: "2px", color: "var(--color-secondary)" }}>
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
                  <span style={{ fontWeight: 700 }}>D<span className="dosys-d" style={{ color: "#355c7d" }}>{"\u014D"}</span>sys</span><sup style={{ fontSize: "7px", verticalAlign: "super", marginLeft: "1px" }}>{"\u2122"}</sup>
                </button>
              </span>
            </p>
          </div>
        </Link>

        {/* Clinical decision support badge — wide desktop only; the calculator gets the width */}
        <span
          className="hidden 2xl:inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] whitespace-nowrap shrink-0"
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
                className="px-2 sm:px-3.5 py-1 text-[11px] sm:text-[13px] font-semibold whitespace-nowrap transition-all"
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
        <div className="hidden lg:flex flex-1 items-center justify-end gap-2">
          <Link
            href="/"
            className="px-2.5 py-1 text-[13px] font-medium transition"
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
            className="px-2.5 py-1 text-[13px] font-medium transition"
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
            className="px-2.5 py-1 text-[13px] font-medium transition"
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
              className="px-2.5 py-1 text-[13px] font-medium transition"
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
              className="ml-1 p-1.5 transition"
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
              aria-label="Clinical settings"
              title="Clinical settings"
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
          {!onLogout && showSignIn && (
            <a
              href="/login"
              className="ml-1 px-2 py-1 text-[11px] font-semibold transition"
              style={{
                color: "var(--color-secondary)",
                border: "1px solid var(--color-border)",
                background: "transparent",
                textDecoration: "none",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = "var(--color-primary)";
                (e.currentTarget as HTMLElement).style.borderColor = "var(--color-primary)";
                (e.currentTarget as HTMLElement).style.color = "#ffffff";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = "transparent";
                (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border)";
                (e.currentTarget as HTMLElement).style.color = "var(--color-secondary)";
              }}
            >
              SIGN IN
            </a>
          )}
        </div>

        {/* ── Compact actions (below lg, where the nav is hidden) ─── */}
        <div className="flex lg:hidden items-center gap-1">
          {onSettingsOpen && (
            <button
              type="button"
              onClick={onSettingsOpen}
              className="p-1.5"
              style={{ color: "var(--color-secondary)", border: "1px solid transparent", background: "transparent", cursor: "pointer" }}
              aria-label="Clinical settings"
              title="Clinical settings"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter" aria-hidden="true">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
          )}
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
          {!onLogout && showSignIn && (
            <a
              href="/login"
              className="px-2 py-1.5 text-[10px] font-semibold"
              style={{ color: "var(--color-secondary)", border: "1px solid var(--color-border)", background: "transparent", textDecoration: "none" }}
            >
              SIGN IN
            </a>
          )}
        </div>

      </div>
    </header>
  );
}
