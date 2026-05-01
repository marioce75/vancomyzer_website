import Link from "next/link";
import { LEGAL_LINKS } from "@/lib/legalLinks";

export default function Footer() {
  return (
    <footer className="border-t" style={{ borderTopColor: "var(--color-border)", background: "var(--color-card)" }}>
      <div className="mx-auto max-w-7xl px-3 sm:px-4 py-6 sm:py-8 md:py-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">

          {/* Brand + disclaimer */}
          <div className="max-w-xl">
            <div className="flex items-center gap-3 mb-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo-signal.svg"
                alt="Vancomyzer™ logo"
                width={32}
                height={32}
              />
              <div>
                <span className="text-sm font-bold" style={{ color: "var(--color-primary)", fontFamily: "'Share Tech Mono', monospace" }}>
                  Vancomyzer™
                </span>
                <p className="text-[11px] leading-none mt-0.5" style={{ color: "var(--color-dim)", fontFamily: "'Share Tech Mono', monospace" }}>
                  Engineered by{" "}
                  <a
                    href="https://dosys.health"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold tracking-wide hover:underline"
                    style={{ color: "inherit" }}
                  >
                    Dōsys&trade;
                  </a>
                </p>
              </div>
            </div>
            <p className="text-sm leading-6" style={{ color: "var(--color-dim)", fontFamily: "'Share Tech Mono', monospace" }}>
              For use by qualified healthcare professionals only. Vancomyzer™ is a clinical decision-support tool and does not constitute medical advice. All dosing recommendations must be independently reviewed and validated by a licensed clinician prior to patient administration. Not a substitute for professional judgment, institutional protocols, or therapeutic drug monitoring.
            </p>
            <p className="mt-4 text-xs" style={{ color: "var(--color-border)", fontFamily: "'Share Tech Mono', monospace" }}>
              © 2026 Vancomyzer™. All Rights Reserved. &nbsp;·&nbsp;{" "}
              <Link href="/disclaimer" className="underline" style={{ color: "var(--color-secondary)" }}>Full Medical Disclaimer</Link>
            </p>
          </div>

          {/* Nav links */}
          <div className="grid gap-6 sm:grid-cols-2 text-sm">
            {/* In-app navigation */}
            <nav className="grid grid-cols-2 gap-x-6 gap-y-2">
              {[
                { href: "/calculator", label: "Calculator" },
                { href: "/references", label: "References" },
                { href: "/faq", label: "FAQ" },
                { href: "/about", label: "About" },
                { href: "/contact", label: "Contact" },
                { href: "/pricing", label: "Pricing" },
              ].map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="transition"
                  style={{ color: "var(--color-secondary)", fontFamily: "'Share Tech Mono', monospace" }}
                >
                  {label}
                </Link>
              ))}
            </nav>

            {/* Legal — canonical documents on dosys.health */}
            <nav className="flex flex-col gap-2">
              <span
                className="text-[10px] font-bold uppercase tracking-[0.18em]"
                style={{ color: "var(--color-dim)", fontFamily: "'Share Tech Mono', monospace" }}
              >
                Legal · dosys.health
              </span>
              {[
                { href: LEGAL_LINKS.disclaimer, label: "Medical Disclaimer" },
                { href: LEGAL_LINKS.privacy, label: "Privacy Policy" },
                { href: LEGAL_LINKS.terms, label: "Terms of Use" },
                { href: LEGAL_LINKS.baa, label: "BAA" },
              ].map(({ href, label }) => (
                <a
                  key={href}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition"
                  style={{ color: "var(--color-secondary)", fontFamily: "'Share Tech Mono', monospace" }}
                >
                  {label} ↗
                </a>
              ))}
            </nav>
          </div>
        </div>
      </div>
    </footer>
  );
}
