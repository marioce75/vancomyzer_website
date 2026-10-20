"use client";
import { LocalizedButton, LocalizedDiv } from "@/localization/LocalizedElements";


import { LanguageSwitcher, LocalizedText, useLanguage } from "@/localization/LanguageProvider";


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
  const { t } = useLanguage();
  return (
    <header
      className="shrink-0 border-b"
      style={{
        background: "var(--color-nav-bg, var(--color-bg))",
        borderBottomColor: "var(--color-nav-border, var(--color-border))",
        boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
      }}
    >
      <div className="vz-calculator-header">

        {/* ── Brand ──────────────────────────────────────── */}
        <div className="vz-calculator-brand">
          <Link href="/" style={{ textDecoration: "none" }} aria-label={t("Vancomyzer home")}>
            <h1
              className="font-bold whitespace-nowrap leading-none transition-colors vancomyzer-title"
              style={{ color: "var(--color-primary)", textShadow: "0 0 10px var(--color-glow)" }}
            >
              VANCOMYZER{"\u2122"}
            </h1>
          </Link>
            <p className="vz-calculator-byline font-medium leading-none" style={{ color: "var(--color-secondary)" }}>
              <span style={{ color: "var(--color-dim)" }}><LocalizedText text="ENGINEERED BY" />{" "}
                <LocalizedButton
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
                  onClick={() => {
                    window.open("https://dosys.health", "_blank", "noopener,noreferrer");
                  }}
                >
                  <span style={{ fontWeight: 700 }}>D<span className="dosys-d" style={{ color: "#1f5e96" }}>{"\u014D"}</span>sys</span><sup style={{ fontSize: "7px", verticalAlign: "super", marginLeft: "1px" }}>{"\u2122"}</sup>
                </LocalizedButton>
              </span>
            </p>
        </div>

        {/* Preserve the support label without adding another item to the bar. */}
        <span
          className="sr-only"
          style={{
            border: "1px solid var(--color-primary-a40)",
            background: "var(--color-primary-a05)",
            color: "var(--color-secondary)",
            fontFamily: "'Share Tech Mono', monospace",
          }}
        >
          <span className="h-1.5 w-1.5 shrink-0 mx-blink" style={{ backgroundColor: "var(--color-primary)", display: "inline-block" }} aria-hidden="true" /><LocalizedText text="CLINICAL DECISION SUPPORT" /></span>

        {/* ── Mode switcher ──────────────────────────────── */}
        <div className="vz-mode-switcher">
          <LocalizedDiv
            className="vz-mode-tabs p-0.5"
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
                className="px-2 py-1 text-[13px] font-semibold whitespace-normal transition-all"
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
                <LocalizedText text={title} />
              </button>
            ))}
          </LocalizedDiv>
        </div>

        {/* ── Nav ───────────────────────────────────────── */}
        <div className="vz-calculator-nav">
          <Link
            href="/"
            className="vz-header-action px-2.5 py-1 text-[13px] font-medium transition"
            style={{ color: "var(--color-secondary)", border: "1px solid transparent", fontFamily: "'Share Tech Mono', monospace" }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.borderColor = "var(--color-primary-a40)";
              (e.currentTarget as HTMLElement).style.background = "var(--color-primary)";
              (e.currentTarget as HTMLElement).style.color = "var(--color-card, #14232f)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.borderColor = "transparent";
              (e.currentTarget as HTMLElement).style.background = "transparent";
              (e.currentTarget as HTMLElement).style.color = "var(--color-secondary)";
            }}
          ><LocalizedText text="Home" /></Link>
          <Link
            href="/faq"
            className="vz-header-action px-2.5 py-1 text-[13px] font-medium transition"
            style={{ color: "var(--color-secondary)", border: "1px solid transparent", fontFamily: "'Share Tech Mono', monospace" }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.borderColor = "var(--color-primary-a40)";
              (e.currentTarget as HTMLElement).style.background = "var(--color-primary)";
              (e.currentTarget as HTMLElement).style.color = "var(--color-card, #14232f)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.borderColor = "transparent";
              (e.currentTarget as HTMLElement).style.background = "transparent";
              (e.currentTarget as HTMLElement).style.color = "var(--color-secondary)";
            }}
          ><LocalizedText text="FAQ" /></Link>
          <Link
            href="/transparent-dosing"
            className="vz-header-action px-2.5 py-1 text-[13px] font-medium transition"
            style={{ color: "var(--color-secondary)", border: "1px solid transparent", fontFamily: "'Share Tech Mono', monospace" }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.borderColor = "var(--color-primary-a40)";
              (e.currentTarget as HTMLElement).style.background = "var(--color-primary)";
              (e.currentTarget as HTMLElement).style.color = "var(--color-card, #14232f)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.borderColor = "transparent";
              (e.currentTarget as HTMLElement).style.background = "transparent";
              (e.currentTarget as HTMLElement).style.color = "var(--color-secondary)";
            }}
          ><LocalizedText text="Evidence" /></Link>
          {userRole === "admin" && (
            <Link
              href="/admin/dashboard"
              className="vz-header-action px-2.5 py-1 text-[13px] font-medium transition"
              style={{ color: "var(--color-secondary)", border: "1px solid transparent", fontFamily: "'Share Tech Mono', monospace", fontWeight: 700 }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.borderColor = "var(--color-primary-a40)";
                (e.currentTarget as HTMLElement).style.background = "var(--color-primary)";
                (e.currentTarget as HTMLElement).style.color = "var(--color-card, #14232f)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.borderColor = "transparent";
                (e.currentTarget as HTMLElement).style.background = "transparent";
                (e.currentTarget as HTMLElement).style.color = "var(--color-secondary)";
              }}
            ><LocalizedText text="Dashboard" /></Link>
          )}
          {onSettingsOpen && (
            <LocalizedButton
              type="button"
              onClick={onSettingsOpen}
              className="vz-header-action ml-1 p-1.5 transition"
              style={{
                color: "var(--color-secondary)",
                border: "1px solid transparent",
                fontFamily: "'Share Tech Mono', monospace",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.borderColor = "var(--color-primary-a40)";
                (e.currentTarget as HTMLElement).style.background = "var(--color-primary)";
                (e.currentTarget as HTMLElement).style.color = "var(--color-card, #14232f)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.borderColor = "transparent";
                (e.currentTarget as HTMLElement).style.background = "transparent";
                (e.currentTarget as HTMLElement).style.color = "var(--color-secondary)";
              }}
              aria-label="Clinical settings"
              title="Clinical settings"
            >
              <LocalizedText text="Settings" />
            </LocalizedButton>
          )}
          {userName && (
            <span className="vz-header-user text-[11px] font-medium" title={userName} style={{ color: "var(--color-dim)" }}>
              {userName}
            </span>
          )}
          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="vz-header-action ml-1 px-2 py-1 text-[11px] font-semibold transition"
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
            ><LocalizedText text="LOGOUT" /></button>
          )}
          {!onLogout && showSignIn && (
            <a
              href="/login"
              className="vz-header-action ml-1 px-2 py-1 text-[11px] font-semibold transition"
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
            ><LocalizedText text="SIGN IN" /></a>
          )}
        </div>

        <LanguageSwitcher compact />

      </div>
    </header>
  );
}
