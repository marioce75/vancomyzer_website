import Link from "next/link";

const navItems = [
  { href: "/faq", label: "FAQ" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export default function Header() {
  return (
    <header
      className="border-b"
      style={{
        background: "var(--color-bg)",
        borderBottomColor: "var(--color-border)",
        boxShadow: "0 1px 0 var(--color-primary-a15)",
      }}
    >
      <nav className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2.5 whitespace-nowrap" style={{ textDecoration: "none" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/favicon.svg" alt="Vancomyzer™" width={32} height={32} className="shrink-0" />
            <span className="font-bold" style={{ fontSize: "18px", letterSpacing: "3px", color: "var(--color-primary)", textShadow: "0 0 8px var(--color-glow)" }}>
              VANCOMYZER<sup className="text-[8px] font-semibold ml-0.5 align-super" style={{ color: "var(--color-secondary)" }}>{"\u2122"}</sup>
            </span>
          </Link>
          <span
            className="hidden px-2.5 py-1 text-[11px] font-medium md:inline-flex"
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
          <ul className="hidden items-center gap-6 md:flex">
            {navItems.map(({ href, label }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="text-sm font-medium transition"
                  style={{ color: "var(--color-secondary)" }}
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href="/login"
            className="inline-flex items-center justify-center px-4 py-2 text-sm font-semibold transition"
            style={{
              border: "1px solid var(--color-primary-a50)",
              background: "var(--color-primary-a08)",
              color: "var(--color-primary)",
              fontFamily: "'Share Tech Mono', monospace",
            }}
          >
            [SIGN IN]
          </Link>
        </div>
      </nav>
    </header>
  );
}
