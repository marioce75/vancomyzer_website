"use client";

import { useState } from "react";
import Link from "next/link";

const navItems = [
  { href: "/faq", label: "FAQ" },
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);

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
          <Link href="/" className="flex items-center gap-2 sm:gap-2.5 whitespace-nowrap" style={{ textDecoration: "none" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-signal.svg" alt="Vancomyzer™" width={28} height={28} className="shrink-0 sm:w-8 sm:h-8" />
            <span className="font-bold text-[15px] sm:text-lg" style={{ letterSpacing: "3px", color: "var(--color-primary)", textShadow: "0 0 8px var(--color-glow)" }}>
              VANCOMYZER<sup className="text-[7px] sm:text-[8px] font-semibold ml-0.5 align-super" style={{ color: "var(--color-secondary)" }}>{"\u2122"}</sup>
            </span>
          </Link>
          <span
            className="hidden px-2.5 py-1 text-[11px] font-medium lg:inline-flex"
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

        <div className="flex items-center gap-4 md:gap-6">
          {/* Desktop nav */}
          <ul className="hidden items-center gap-4 lg:gap-6 md:flex">
            {navItems.map(({ href, label }) => (
              <li key={href}>
                <Link href={href} className="text-sm font-medium transition" style={{ color: "var(--color-secondary)" }}>
                  {label}
                </Link>
              </li>
            ))}
          </ul>

          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 -mr-2"
            style={{ color: "var(--color-secondary)" }}
            aria-label="Toggle menu"
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

      {/* Mobile dropdown menu */}
      {mobileOpen && (
        <div className="md:hidden border-t px-4 py-3 space-y-1" style={{ borderTopColor: "var(--color-border)", background: "var(--color-bg)" }}>
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
        </div>
      )}
    </header>
  );
}
