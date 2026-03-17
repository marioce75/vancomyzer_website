import Link from "next/link";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/trust-evidence", label: "Trust & Evidence" },
  { href: "/faq", label: "FAQ" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export default function Header() {
  return (
    <header className="border-b border-gray-200 bg-white">
      <nav className="mx-auto flex max-w-4xl items-center justify-between gap-6 px-4 py-4">
        <Link href="/" className="text-lg font-semibold text-gray-900">
          Vancomyzer
        </Link>
        <ul className="flex flex-wrap items-center gap-6">
          {navItems.map(({ href, label }) => (
            <li key={href}>
              <Link
                href={href}
                className="text-sm font-medium text-gray-600 hover:text-gray-900"
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
