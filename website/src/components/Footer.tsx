import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t" style={{ borderTopColor: "var(--color-border)", background: "var(--color-card)" }}>
      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">

          {/* Brand + disclaimer */}
          <div className="max-w-xl">
            <div className="flex items-center gap-3 mb-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/favicon.svg"
                alt="Vancomyzer™ logo"
                width={32}
                height={32}
              />
              <div>
                <span className="text-sm font-bold" style={{ color: "var(--color-primary)", fontFamily: "'Share Tech Mono', monospace" }}>
                  Vancomyzer™
                </span>
                <p className="text-[11px] leading-none mt-0.5" style={{ color: "var(--color-dim)", fontFamily: "'Share Tech Mono', monospace" }}>
                  Engineered by <span className="font-semibold tracking-wide">Dōsys&trade;</span>
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
          <nav className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm md:grid-cols-3">
            {[
              { href: "/calculator", label: "Calculator" },
              { href: "/references", label: "References" },
              { href: "/faq", label: "FAQ" },
              { href: "/about", label: "About" },
              { href: "/contact", label: "Contact" },
              { href: "/disclaimer", label: "Medical Disclaimer" },
              { href: "/privacy", label: "Privacy" },
              { href: "/terms", label: "Terms" },
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
        </div>
      </div>
    </footer>
  );
}
