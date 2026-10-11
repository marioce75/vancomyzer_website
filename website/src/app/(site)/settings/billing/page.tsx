"use client";

import { LocalizedText } from "@/localization/LanguageProvider";


import { useState, useEffect, Suspense } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { TIERS, isPaidTier } from "@/lib/tiers";

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
    return <div style={{ padding: 40, textAlign: "center", color: "var(--color-dim)" }}><LocalizedText text="Loading..." /></div>;
  }

  if (!user) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <p style={{ color: "var(--color-secondary)" }}><LocalizedText text={"Please"} />{" "}<Link href="/login" style={{ color: "var(--color-primary)" }}><LocalizedText text="sign in" /></Link>{" "}<LocalizedText text={"to manage your subscription."} /></p>
      </div>
    );
  }

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
  const onPaidTier = isPaidTier(user.billingTier);
  const status = user.subscriptionStatus ?? "active";

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 16px 80px" }}>
      <div style={{ display: "flex", gap: 16, fontSize: 13, marginBottom: 16, flexWrap: "wrap" }}>
        <Link href="/settings" style={{ color: "var(--color-dim)", textDecoration: "none" }}><LocalizedText text="Institutional Settings" /></Link>
        <span aria-hidden="true" style={{ color: "#546471" }}>·</span>
        <span style={{ color: "var(--color-primary)", fontWeight: 600 }}><LocalizedText text={"Billing"} /></span>
        <span aria-hidden="true" style={{ color: "#546471" }}>·</span>
        <Link href="/settings/history" style={{ color: "var(--color-dim)", textDecoration: "none" }}><LocalizedText text="Calculation History" /></Link>
      </div>

      <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--color-primary)", marginBottom: 4 }}><LocalizedText text="Billing & Subscription" /></h1>
      <p style={{ fontSize: 13, color: "var(--color-dim)", marginBottom: 24 }}><LocalizedText text={"Manage your Vancomyzer™ subscription. Billing is handled by Stripe."} /></p>

      {banner && (
        <div style={{
          padding: "10px 14px", marginBottom: 16,
          background: "#ecfdf5", border: "1px solid #6ee7b7", color: "#047857", fontSize: 13, borderRadius: 4,
        }}>
          <LocalizedText text={banner} />
        </div>
      )}

      {error && (
        <div style={{
          padding: "10px 14px", marginBottom: 16,
          background: "#fff5f5", border: "1px solid #fca5a5", color: "#991b1b", fontSize: 13, borderRadius: 4,
        }}>
          <LocalizedText text={error} />
        </div>
      )}

      {user.complimentaryPro?.active && <div className="mb-6 border border-teal-700 p-4">
        <h2 className="font-semibold"><LocalizedText text={"Complimentary Pro access"} /></h2>
        <p><LocalizedText text={user.complimentaryPro.expiresAt ? `Ends ${new Date(user.complimentaryPro.expiresAt).toUTCString()}.` : "No expiration date."} />{" "}<LocalizedText text={"No card required and no automatic paid renewal."} /></p>
        <p><LocalizedText text={"When this grant ends, your underlying plan applies. Any existing paid subscription continues separately; use Manage billing to review or cancel it."} /></p>
      </div>}
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
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-dim)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}><LocalizedText text={"Current plan"} /></div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "var(--color-primary)" }}>
              {tier.name}
            </div>
            <div style={{ fontSize: 12, color: "var(--color-secondary)", marginTop: 2 }}>
              <LocalizedText text={onPaidTier ? "Your existing subscription amount and renewal terms are shown in Manage billing." : user.complimentaryPro?.active ? "Complimentary · $0" : tier.priceLabel} />
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
              <LocalizedText text={statusLabel(status)} />
            </span>
          )}
        </div>

        {onPaidTier && user.subscriptionExpiry && (
          <div style={{ fontSize: 12, color: "var(--color-secondary)", paddingTop: 12, borderTop: "1px solid var(--color-border)" }}>
            <LocalizedText text={status === "trialing" ? "Trial ends" : status === "canceled" ? "Access ends" : "Renews"} />{" "}
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
              <LocalizedText text={working ? "Opening…" : "Manage billing / cancel"} />
            </button>
            <span style={{ fontSize: 11, color: "var(--color-dim)", alignSelf: "center" }}><LocalizedText text={"Change plan, update payment method, download invoices, or cancel — all in Stripe's secure portal."} /></span>
          </div>
        )}
      </div>

      {!onPaidTier && <section className="mb-6 border p-4">
        <h2><LocalizedText text="Free access" /></h2>
        <p><LocalizedText text="Access to Vancomyzer is currently free." /></p>
        <Link href="/calculator" className="underline"><LocalizedText text="Open the calculator" /></Link>
      </section>}

      {/* Department / Hospital hint */}
      <div style={{
        padding: 16,
        background: "var(--color-card)",
        border: "1px solid var(--color-border)",
        borderRadius: 6,
        fontSize: 13,
        color: "var(--color-secondary)",
        lineHeight: 1.6,
      }}><LocalizedText text={"Contact us about account access or institutional requirements."} />{" "}
        <a
          href="https://dosys.health/contact"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "var(--color-primary)", textDecoration: "underline" }}
        ><LocalizedText text="Contact" /></a>{" "}<LocalizedText text={"on dosys.health."} /></div>
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: "center", color: "var(--color-dim)" }}><LocalizedText text="Loading..." /></div>}>
      <BillingPageInner />
    </Suspense>
  );
}
