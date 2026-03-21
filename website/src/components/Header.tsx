import Link from "next/link";

const navItems = [
  { href: "/trust-evidence", label: "Trust & Evidence" },
  { href: "/faq", label: "FAQ" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export default function Header() {
  return (
    <header className="border-b border-slate-200 bg-white/95 backdrop-blur">
      <nav className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-3">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-lg font-semibold tracking-tight text-slate-950">
            Vancomyzer
          </Link>
          <span className="hidden rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600 md:inline-flex">
            clinician review support
          </span>
        </div>

        <div className="flex items-center gap-4 md:gap-6">
          <ul className="hidden items-center gap-6 md:flex">
            {navItems.map(({ href, label }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="text-sm font-medium text-slate-600 transition hover:text-slate-950"
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href="/calculator"
            className="inline-flex items-center justify-center rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-2 text-sm font-semibold text-cyan-900 transition hover:bg-cyan-100"
          >
            Open calculator
          </Link>
        </div>
      </nav>
    </header>
  );
}
