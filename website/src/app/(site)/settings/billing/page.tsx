"use client";

import { useState, useEffect, Suspense } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { TIERS, isPaidTier } from "@/lib/tiers";

type CheckoutPlan = "monthly" | "annual";

const PLAN_LABELS: Record<CheckoutPlan, { label: string; price: string; sub: string }> = {
  monthly: {
    label: "Monthly",
    price: "$19.99",
    sub: "billed monthly · cancel anytime",
  },
  annual: {
    label: "Annual",
    price: "$9.99 / mo",
    sub: "billed yearly · save ~50%",
  },
};

function statusBadgeStyle(status: string): React.CSSProperties {
  switch (status) {
    case "trialing":
      return { background: "#dbeafe", border: "1px solid #93c5fd", color: "#1e3a8a" };
    case "active":
      return { background: "#ecfdf5", border: "1px solid #6ee7b7", color: "#047857" };
    case "past_due":
      return { background: "#fef3c7", border: "1px solid #fcd34d", color: "#92400e" };
    case "canceled":
    case "incomplete":
    case "unpaid":
      return { background: "#fff5f5", border: "1px solid #fca5a5", color: "#991b1b" };
    default:
      return { background: "var(--color-card)", border: "1px solid var(--color-border)", color: "var(--color-secondary)" };
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case "trialing": return "Trial · 14 days";
    case "active": return "Active";
    case "past_due": return "Past due";
    case "canceled": return "Canceled";
    case "incomplete": return "Incomplete";
    case "unpaid": return "Unpaid";
    default: return status;
  }
}

function formatExpiry(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function BillingPageInner() {
  const { user, loading } = useAuth();
  const searchParams = useSearchParams();
  const checkoutResult = searchParams.get("checkout");

  const [plan, setPlan] = useState<CheckoutPlan>("annual");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  useEffect(() => {
    if (checkoutResult === "success") {
      setBanner("Trial started. Your subscription will appear once Stripe confirms — usually within a few seconds.");
    } else if (checkoutResult === "cancelled") {
      setBanner("Checkout cancelled. No charges were made.");
    }
  }, [checkoutResult]);

  if (loading) {
    return <div style={{ padding: 40, textAlign: "center", color: "var(--color-dim)" }}>Loading...</div>;
  }

  if (!user) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <p style={{ color: "var(--color-secondary)" }}>
          Please <Link href="/login" style={{ color: "var(--color-primary)" }}>sign in</Link> to manage your subscription.
        </p>
      </div>
    );
  }

  const startCheckout = async () => {
    setError(null);
    setWorking(true);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const body = await res.json();
      if (!res.ok || !body.url) {
        setError(body.error ?? "Could not start checkout. Try again.");
        setWorking(false);
        return;
      }
      window.location.href = body.url;
    } catch {
      setError("Network error. Try again.");
      setWorking(false);
    }
  };

  const openPortal = async () => {
    setError(null);
    setWorking(true);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const body = await res.json();
      if (!res.ok || !body.url) {
        setError(body.error ?? "Could not open billing portal.");
        setWorking(false);
        return;
      }
      window.location.href = body.url;
    } catch {
      setError("Network error. Try again.");
      setWorking(false);
    }
  };

  const tier = TIERS[user.subscriptionTier];
  const onPaidTier = isPaidTier(user.subscriptionTier);
  const status = user.subscriptionStatus ?? "active";

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 16px 80px" }}>
      <div style={{ display: "flex", gap: 16, fontSize: 13, marginBottom: 16, flexWrap: "wrap" }}>
        <Link href="/settings" style={{ color: "var(--color-dim)", textDecoration: "none" }}>
          ← Institutional Settings
        </Link>
        <span style={{ color: "var(--color-border)" }}>·</span>
        <span style={{ color: "var(--color-primary)", fontWeight: 600 }}>Billing</span>
        <span style={{ color: "var(--color-border)" }}>·</span>
        <Link href="/settings/history" style={{ color: "var(--color-dim)", textDecoration: "none" }}>
          Calculation History
        </Link>
      </div>

      <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--color-primary)", marginBottom: 4 }}>
        Billing &amp; Subscription
      </h1>
      <p style={{ fontSize: 13, color: "var(--color-dim)", marginBottom: 24 }}>
        Manage your Vancomyzer&trade; subscription. Billing is handled by Stripe.
      </p>

      {banner && (
        <div style={{
          padding: "10px 14px", marginBottom: 16,
          background: "#ecfdf5", border: "1px solid #6ee7b7", color: "#047857", fontSize: 13, borderRadius: 4,
        }}>
          {banner}
        </div>
      )}

      {error && (
        <div style={{
          padding: "10px 14px", marginBottom: 16,
          background: "#fff5f5", border: "1px solid #fca5a5", color: "#991b1b", fontSize: 13, borderRadius: 4,
        }}>
          {error}
        </div>
      )}

      {/* Current plan card */}
      <div style={{
        padding: 20,
        marginBottom: 24,
        background: "var(--color-card)",
        border: "1px solid var(--color-border)",
        borderRadius: 6,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-dim)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>
              Current plan
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "var(--color-primary)" }}>
              {tier.name}
            </div>
            <div style={{ fontSize: 12, color: "var(--color-secondary)", marginTop: 2 }}>
              {tier.priceLabel}
            </div>
          </div>
          {onPaidTier && (
            <span style={{
              padding: "4px 10px",
              fontSize: 11,
              fontWeight: 600,
              borderRadius: 4,
              ...statusBadgeStyle(status),
            }}>
              {statusLabel(status)}
            </span>
          )}
        </div>

        {onPaidTier && user.subscriptionExpiry && (
          <div style={{ fontSize: 12, color: "var(--color-secondary)", paddingTop: 12, borderTop: "1px solid var(--color-border)" }}>
            {status === "trialing" ? "Trial ends" : status === "canceled" ? "Access ends" : "Renews"}{" "}
            <strong style={{ color: "var(--color-primary)" }}>{formatExpiry(user.subscriptionExpiry)}</strong>
          </div>
        )}

        {onPaidTier && (
          <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={openPortal}
              disabled={working}
              style={{
                padding: "10px 16px", fontSize: 13, fontWeight: 600,
                background: "var(--color-primary)", color: "#ffffff", border: "none", borderRadius: 4,
                cursor: working ? "wait" : "pointer", opacity: working ? 0.7 : 1,
              }}
            >
              {working ? "Opening…" : "Manage billing"}
            </button>
            <span style={{ fontSize: 11, color: "var(--color-dim)", alignSelf: "center" }}>
              Change plan, update payment method, download invoices, or cancel — all in Stripe&apos;s secure portal.
            </span>
          </div>
        )}
      </div>

      {/* Upgrade card — only for free users */}
      {!onPaidTier && (
        <div style={{
          padding: 20,
          marginBottom: 24,
          background: "var(--color-card)",
          border: "2px solid var(--color-primary)",
          borderRadius: 6,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-primary)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>
            Upgrade to Individual Pro
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "var(--color-primary)", marginBottom: 8 }}>
            14-day free trial · card required upfront, no charge until trial ends
          </div>
          <ul style={{ margin: "0 0 16px", padding: 0, listStyle: "none", fontSize: 13, color: "var(--color-secondary)", lineHeight: 1.7 }}>
            {TIERS.individual_pro.features.map(f => (
              <li key={f} style={{ paddingLeft: 18, position: "relative" }}>
                <span style={{ position: "absolute", left: 0, color: "#0d9488", fontWeight: 700 }}>✓</span>
                {f}
              </li>
            ))}
          </ul>

          {/* Plan selector */}
          <div role="radiogroup" aria-label="Billing cadence" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
            {(Object.keys(PLAN_LABELS) as CheckoutPlan[]).map(p => {
              const selected = plan === p;
              const meta = PLAN_LABELS[p];
              return (
                <button
                  key={p}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setPlan(p)}
                  style={{
                    padding: "12px 14px",
                    textAlign: "left",
                    background: selected ? "var(--color-primary)" : "var(--color-card)",
                    color: selected ? "#ffffff" : "var(--color-secondary)",
                    border: `2px solid ${selected ? "var(--color-primary)" : "var(--color-border)"}`,
                    borderRadius: 4,
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.85, marginBottom: 4 }}>
                    {meta.label}
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>
                    {meta.price}
                  </div>
                  <div style={{ fontSize: 10, opacity: 0.85, marginTop: 2 }}>
                    {meta.sub}
                  </div>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={startCheckout}
            disabled={working}
            style={{
              width: "100%",
              padding: 14,
              fontSize: 14,
              fontWeight: 700,
              background: "var(--color-primary)",
              color: "#ffffff",
              border: "none",
              borderRadius: 4,
              cursor: working ? "wait" : "pointer",
              opacity: working ? 0.7 : 1,
              letterSpacing: "0.02em",
            }}
          >
            {working ? "Starting checkout…" : `Start 14-Day Trial · ${PLAN_LABELS[plan].label}`}
          </button>
          <p style={{ fontSize: 11, color: "var(--color-dim)", textAlign: "center", marginTop: 10, marginBottom: 0, lineHeight: 1.5 }}>
            You will not be charged for 14 days. Cancel any time during the trial in the billing portal — no charge.
            By starting a trial you agree to our{" "}
            <Link href="/terms" style={{ color: "var(--color-primary)", textDecoration: "underline" }}>Terms</Link>{" "}
            and{" "}
            <Link href="/privacy" style={{ color: "var(--color-primary)", textDecoration: "underline" }}>Privacy Policy</Link>.
          </p>
        </div>
      )}

      {/* Department / Hospital hint */}
      <div style={{
        padding: 16,
        background: "var(--color-card)",
        border: "1px solid var(--color-border)",
        borderRadius: 6,
        fontSize: 13,
        color: "var(--color-secondary)",
        lineHeight: 1.6,
      }}>
        Need access for your whole department or hospital? See{" "}
        <a
          href="https://dosys.health/pricing"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "var(--color-primary)", textDecoration: "underline" }}
        >
          Department &amp; Hospital plans
        </a>{" "}
        on dosys.health.
      </div>
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: "center", color: "var(--color-dim)" }}>Loading...</div>}>
      <BillingPageInner />
    </Suspense>
  );
}
