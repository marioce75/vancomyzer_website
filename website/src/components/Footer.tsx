import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="max-w-xl">
            <p className="text-sm font-medium text-slate-900">Vancomyzer</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Transparent vancomycin dosing support for clinician review. For decision support only; final treatment decisions should reflect clinician judgment, patient-specific context, and local protocol.
            </p>
          </div>
          <nav className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm md:grid-cols-3">
            <Link href="/calculator" className="text-slate-600 hover:text-slate-950">Calculator</Link>
            <Link href="/trust-evidence" className="text-slate-600 hover:text-slate-950">Trust & Evidence</Link>
            <Link href="/faq" className="text-slate-600 hover:text-slate-950">FAQ</Link>
            <Link href="/about" className="text-slate-600 hover:text-slate-950">About</Link>
            <Link href="/contact" className="text-slate-600 hover:text-slate-950">Contact</Link>
            <Link href="/disclaimer" className="text-slate-600 hover:text-slate-950">Medical Disclaimer</Link>
            <Link href="/privacy" className="text-slate-600 hover:text-slate-950">Privacy</Link>
            <Link href="/terms" className="text-slate-600 hover:text-slate-950">Terms</Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
