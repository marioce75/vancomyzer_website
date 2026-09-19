"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";

const navItems = [
  { href: "/transparent-dosing", label: "Transparency" },
  { href: "/faq", label: "FAQ" },
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

// Primary "Calculator" action. Tailwind arbitrary classes rather than an
// inline style so no hover JS is needed; teal-700 keeps white text above
// 4.5:1 contrast on the light header.
const CALCULATOR_BUTTON_CLASS =
  "items-center justify-center rounded-md bg-[#0f766e] font-semibold text-white whitespace-nowrap transition hover:bg-[#115e59] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f766e]";

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, loading } = useAuth();
  // Offer "Sign in" only once the session check has finished and found
  // nobody, so signed-in clinicians never see it flash on first paint.
  const showSignIn = !loading && !user;

  return (
    <header
      className="border-b"
      style={{
        background: "var(--color-bg)",
        borderBottomColor: "var(--color-border)",
        boxShadow: "0 1px 0 var(--color-primary-a15)",
      }}
    >
      <nav className="mx-auto flex max-w-7xl items-center justify-between gap-3 sm:gap-6 px-3 sm:px-4 py-3">
        <div className="flex items-center gap-2 sm:gap-3">
          <a href="https://dosys.health" target="_blank" rel="noopener noreferrer" aria-label="Visit dosys.health" className="shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-signal.svg" alt="Dōsys™" width={96} height={28} className="shrink-0 sm:w-[124px] sm:h-9" />
          </a>
          <Link href="/" className="whitespace-nowrap" style={{ textDecoration: "none" }}>
            <span className="font-bold text-[15px] sm:text-lg" style={{ letterSpacing: "3px", color: "var(--color-primary)", textShadow: "0 0 8px var(--color-glow)" }}>
              VANCOMYZER<sup className="text-[7px] sm:text-[8px] font-semibold ml-0.5 align-super" style={{ color: "var(--color-secondary)" }}>{"™"}</sup>
            </span>
          </Link>
          {/* Badge moved from lg to xl so the added Sign in + Calculator
              actions fit on one row at 1024px without wrapping. */}
          <span
            className="hidden px-2.5 py-1 text-[11px] font-medium xl:inline-flex"
            style={{
              border: "1px solid var(--color-primary-a40)",
              background: "var(--color-primary-a05)",
              color: "var(--color-secondary)",
              fontFamily: "'Share Tech Mono', monospace",
            }}
          >
            clinician review support
          </span>
        </div>

        <div className="flex items-center gap-3 lg:gap-6">
          {/* Desktop nav — breakpoint raised from md to lg: with the two new
              actions the full row overflows between 768px and 1023px, so
              tablets use the menu instead. */}
          <ul className="hidden items-center gap-6 lg:flex">
            {navItems.map(({ href, label }) => (
              <li key={href}>
                <Link href={href} className="text-sm font-medium transition" style={{ color: "var(--color-secondary)" }}>
                  {label}
                </Link>
              </li>
            ))}
          </ul>

          {showSignIn && (
            <a
              href="/login"
              className="hidden whitespace-nowrap text-sm font-medium transition lg:inline"
              style={{ color: "var(--color-secondary)" }}
            >
              Sign in
            </a>
          )}

          {/* Primary action — in the bar from 640px up; phones get it at the
              top of the menu (the bar has no room beside the brand at 320px). */}
          <Link href="/calculator" className={`hidden px-4 py-2 text-sm sm:inline-flex ${CALCULATOR_BUTTON_CLASS}`}>
            Calculator
          </Link>

          {/* Mobile / tablet hamburger */}
          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="lg:hidden p-2 -mr-2"
            style={{ color: "var(--color-secondary)" }}
            aria-label="Toggle menu"
            aria-controls="site-mobile-menu"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {mobileOpen ? (
                <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>
              ) : (
                <><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>
              )}
            </svg>
          </button>
        </div>
      </nav>

      {/* Mobile / tablet dropdown menu */}
      {mobileOpen && (
        <div id="site-mobile-menu" className="lg:hidden border-t px-4 py-3 space-y-1" style={{ borderTopColor: "var(--color-border)", background: "var(--color-bg)" }}>
          <Link
            href="/calculator"
            onClick={() => setMobileOpen(false)}
            className={`mb-2 flex w-full px-3 py-2.5 text-sm ${CALCULATOR_BUTTON_CLASS}`}
          >
            Open Calculator
          </Link>
          {navItems.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className="block py-2.5 px-3 text-sm font-medium rounded transition"
              style={{ color: "var(--color-secondary)" }}
            >
              {label}
            </Link>
          ))}
          {showSignIn && (
            <a
              href="/login"
              onClick={() => setMobileOpen(false)}
              className="block py-2.5 px-3 text-sm font-semibold rounded transition"
              style={{ color: "var(--color-primary)", borderTop: "1px solid var(--color-border)" }}
            >
              Sign in
            </a>
          )}
        </div>
      )}
    </header>
  );
}
