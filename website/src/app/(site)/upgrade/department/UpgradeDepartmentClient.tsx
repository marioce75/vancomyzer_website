"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

const MIN_SEATS = 5;
const MAX_SEATS = 20;
const SMALL_BAND = 10;
const SMALL_PRICE_USD = 500;
const LARGE_PRICE_USD = 1000;
const TRIAL_DAYS = 14;

function priceForSeats(seats: number): { amount: number; band: "small" | "large"; label: string } {
  if (seats <= SMALL_BAND) {
    return { amount: SMALL_PRICE_USD, band: "small", label: `Up to ${SMALL_BAND} seats` };
  }
  return { amount: LARGE_PRICE_USD, band: "large", label: `Up to ${MAX_SEATS} seats` };
}

export default function UpgradeDepartmentClient() {
  const [institutionName, setInstitutionName] = useState("");
  const [seats, setSeats] = useState<number>(SMALL_BAND);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pricing = useMemo(() => priceForSeats(seats), [seats]);
  const trialEnd = useMemo(
    () => new Date(Date.now() + TRIAL_DAYS * 86400000).toLocaleDateString("en-US", {
      year: "numeric", month: "long", day: "numeric",
    }),
    [],
  );

  const canSubmit = institutionName.trim().length > 0 && seats >= MIN_SEATS && seats <= MAX_SEATS && !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/department-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ institution_name: institutionName.trim(), seats }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        if (res.status === 401) {
          setError("You need to sign in first. Opening the login page…");
          setTimeout(() => { window.location.href = `/login?next=${encodeURIComponent("/upgrade/department")}`; }, 1500);
          return;
        }
        setError(data.error ?? "Could not start checkout. Please try again.");
        setSubmitting(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <div className="mb-10 text-center">
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em]" style={{ color: "#0d9488" }}>
          Department · self-serve
        </p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl" style={{ color: "var(--color-primary)" }}>
          Set up Vancomyzer for your team
        </h1>
        <p className="mt-3 text-base" style={{ color: "var(--color-secondary)" }}>
          14-day free trial · no charge until trial ends · cancel anytime
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8 rounded-lg border p-8" style={{ borderColor: "var(--color-border)", background: "var(--color-bg)" }}>
        {/* Institution name */}
        <div>
          <label htmlFor="institution-name" className="block text-sm font-semibold" style={{ color: "var(--color-primary)" }}>
            Institution name
          </label>
          <p className="mt-1 text-xs" style={{ color: "var(--color-secondary)" }}>
            How your hospital, department, or group should appear on receipts and the admin panel.
          </p>
          <input
            id="institution-name"
            type="text"
            value={institutionName}
            onChange={(e) => setInstitutionName(e.target.value)}
            placeholder="e.g., Mass General Pharmacy Department"
            maxLength={200}
            required
            className="mt-3 block w-full rounded-md border px-3 py-2 text-sm"
            style={{ borderColor: "var(--color-border)", background: "#ffffff", color: "var(--color-foreground)" }}
          />
        </div>

        {/* Seat picker */}
        <div>
          <label className="block text-sm font-semibold" style={{ color: "var(--color-primary)" }}>
            Team size
          </label>
          <p className="mt-1 text-xs" style={{ color: "var(--color-secondary)" }}>
            Two flat plans. Pick how many clinicians will use Vancomyzer.
          </p>
          <div className="mt-3 flex items-center gap-4">
            <input
              type="range"
              min={MIN_SEATS}
              max={MAX_SEATS}
              step={1}
              value={seats}
              onChange={(e) => setSeats(Number(e.target.value))}
              className="flex-1"
              aria-label="Number of seats"
            />
            <span className="w-16 text-right text-base font-semibold" style={{ color: "var(--color-primary)" }}>
              {seats} seats
            </span>
          </div>
        </div>

        {/* Live pricing summary */}
        <div className="rounded-md border-l-4 px-5 py-4" style={{ borderColor: "#0d9488", background: "rgba(13,148,136,0.05)" }}>
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-semibold" style={{ color: "var(--color-primary)" }}>
              Department · {pricing.label}
            </span>
            <span className="text-2xl font-extrabold" style={{ color: "var(--color-primary)" }}>
              ${pricing.amount}<span className="ml-1 text-sm font-medium" style={{ color: "var(--color-secondary)" }}>/mo</span>
            </span>
          </div>
          <p className="mt-2 text-xs" style={{ color: "var(--color-secondary)" }}>
            First charge on <strong>{trialEnd}</strong> ({TRIAL_DAYS} days from today). Cancel before then for $0.
          </p>
        </div>

        {/* What's included */}
        <ul className="space-y-2 text-sm" style={{ color: "var(--color-foreground)" }}>
          {[
            "Everything in Individual Pro",
            "Unlimited user seats with shared workspace",
            "Admin panel: user management, roles, audit logs",
            "Calculation history across the whole team",
            "Priority email support (24-hour SLA)",
            "Onboarding assistance",
          ].map((feature) => (
            <li key={feature} className="flex items-start gap-2">
              <svg className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "#0d9488" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              {feature}
            </li>
          ))}
        </ul>

        {/* Error display */}
        {error && (
          <div className="rounded-md border-l-4 px-4 py-3 text-sm" style={{ borderColor: "#dc2626", background: "#fef2f2", color: "#991b1b" }}>
            {error}
          </div>
        )}

        {/* Submit */}
        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/pricing"
            className="text-sm font-medium"
            style={{ color: "var(--color-secondary)" }}
          >
            ← Back to pricing
          </Link>
          <button
            type="submit"
            disabled={!canSubmit}
            className="rounded-md px-6 py-2.5 text-sm font-bold uppercase tracking-wider transition"
            style={{
              background: canSubmit ? "#0d9488" : "var(--color-border)",
              color: canSubmit ? "#ffffff" : "var(--color-dim)",
              cursor: canSubmit ? "pointer" : "not-allowed",
              letterSpacing: "0.06em",
            }}
          >
            {submitting ? "Redirecting to checkout…" : `Start ${TRIAL_DAYS}-day trial →`}
          </button>
        </div>

        <p className="text-xs" style={{ color: "var(--color-dim)" }}>
          By starting the trial you become the institution admin. You can invite teammates immediately,
          and assign admin to another user any time from the admin panel. Card is captured upfront;
          Stripe authorizes but does not charge until the trial ends.
        </p>
      </form>
    </main>
  );
}
