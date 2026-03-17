import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-white">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <Link href="/about" className="text-gray-600 hover:text-gray-900">
            About
          </Link>
          <Link href="/trust-evidence" className="text-gray-600 hover:text-gray-900">
            Trust & Evidence
          </Link>
          <Link href="/faq" className="text-gray-600 hover:text-gray-900">
            FAQ
          </Link>
          <Link href="/contact" className="text-gray-600 hover:text-gray-900">
            Contact
          </Link>
          <Link href="/calculator" className="text-gray-600 hover:text-gray-900">
            Calculator
          </Link>
          <Link href="/#sample-case" className="text-gray-600 hover:text-gray-900">
            Review a sample case
          </Link>
          <Link href="/#documentation" className="text-gray-600 hover:text-gray-900">
            Review a documentation-ready summary
          </Link>
        </nav>
        <p className="mt-4 text-xs text-gray-500">
          Vancomyzer is designed to support review of vancomycin dosing workflow with greater clarity and interpretability.
        </p>
      </div>
    </footer>
  );
}
