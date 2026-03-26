import Link from "next/link";

const navItems = [
  { href: "/trust-evidence", label: "Trust & Evidence" },
  { href: "/faq", label: "FAQ" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export default function Header() {
  return (
    <header
      className="border-b"
      style={{
        background: "#000000",
        borderBottomColor: "#003b00",
        boxShadow: "0 1px 0 rgba(0,255,65,0.15)",
      }}
    >
      <nav className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-base font-bold tracking-tight whitespace-nowrap" style={{ color: "#00ff41", fontFamily: "'Share Tech Mono', monospace", textShadow: "0 0 8px rgba(0,255,65,0.4)" }}>
            Vancomyzer<sup className="text-[9px] font-semibold ml-0.5 align-super" style={{ color: "#00a827" }}>™</sup>
          </Link>
          <span
            className="hidden px-2.5 py-1 text-[11px] font-medium md:inline-flex"
            style={{
              border: "1px solid rgba(0,255,65,0.4)",
              background: "rgba(0,255,65,0.05)",
              color: "#00a827",
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
                  style={{ color: "#00a827", fontFamily: "'Share Tech Mono', monospace" }}
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href="/calculator"
            className="inline-flex items-center justify-center px-4 py-2 text-sm font-semibold transition"
            style={{
              border: "1px solid rgba(0,255,65,0.5)",
              background: "rgba(0,255,65,0.08)",
              color: "#00ff41",
              fontFamily: "'Share Tech Mono', monospace",
            }}
          >
            [OPEN CALCULATOR]
          </Link>
        </div>
      </nav>
    </header>
  );
}
