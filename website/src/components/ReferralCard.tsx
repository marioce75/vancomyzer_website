"use client";

/**
 * Referral card — shown on /settings. Renders the user's referral link
 * + stats and a Copy button. Lazy-fetches from /api/referrals/me so
 * existing users get a code generated on first view.
 *
 * Marketing intent: every Pro signup the user refers earns them one
 * free month, credited automatically to their Stripe invoice (or
 * deferred to their first paid subscription if they're still on Free).
 */

import { useEffect, useState } from "react";

interface ReferralData {
  code: string;
  url: string;
  stats: {
    total_referred: number;
    converted_count: number;
    pending_count: number;
    credits_applied: number;
    credits_total_cents: number;
  };
}

export default function ReferralCard() {
  const [data, setData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/referrals/me");
        if (!res.ok) {
          if (!cancelled) setError("Could not load referrals.");
          return;
        }
        const json = (await res.json()) as ReferralData;
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setError("Network error.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleCopy = async () => {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(data.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — fall back to manual select */
    }
  };

  if (loading) {
    return <div style={cardStyle}><span style={{ color: "var(--color-dim)", fontSize: 13 }}>Loading referrals…</span></div>;
  }
  if (error || !data) {
    return null;
  }

  const earned = (data.stats.credits_total_cents / 100).toFixed(2);

  return (
    <section style={cardStyle}>
      <header style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--color-primary)", margin: 0, letterSpacing: "0.04em", textTransform: "uppercase" }}>
          Invite a colleague — get 1 month free
        </h2>
        <span style={{ fontSize: 11, color: "var(--color-dim)" }}>
          Earn one free month every time a referred colleague subscribes to Pro.
        </span>
      </header>

      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <input
          type="text"
          readOnly
          value={data.url}
          onFocus={(e) => e.currentTarget.select()}
          style={{
            flex: 1,
            minWidth: 240,
            padding: "9px 12px",
            fontSize: 13,
            fontFamily: "'Share Tech Mono', monospace",
            color: "var(--color-primary)",
            background: "var(--color-bg)",
            border: "1px solid var(--color-border)",
            borderRadius: 4,
          }}
        />
        <button
          type="button"
          onClick={handleCopy}
          style={{
            padding: "9px 18px",
            fontSize: 13,
            fontWeight: 600,
            background: copied ? "#047857" : "var(--color-primary)",
            color: "#ffffff",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            minWidth: 110,
          }}
        >
          {copied ? "✓ Copied!" : "Copy link"}
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10, marginBottom: 12 }}>
        <Stat label="Referred" value={String(data.stats.total_referred)} />
        <Stat label="Converted" value={String(data.stats.converted_count)} highlight={data.stats.converted_count > 0} />
        <Stat label="Pending" value={String(data.stats.pending_count)} />
        <Stat label="Earned" value={`$${earned}`} highlight={data.stats.credits_total_cents > 0} />
      </div>

      <p style={{ fontSize: 11, color: "var(--color-dim)", margin: 0, lineHeight: 1.55 }}>
        Share your link with colleagues. When they subscribe to Pro, $9.99 (one month of Pro) is credited to your next Stripe invoice automatically. If you&apos;re still on Free, the credit is held until your first paid subscription.
      </p>
    </section>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{ padding: "8px 12px", background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: 4 }}>
      <div style={{ fontSize: 10, color: "var(--color-dim)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, color: highlight ? "#047857" : "var(--color-primary)", marginTop: 2 }}>
        {value}
      </div>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  padding: 16,
  marginBottom: 24,
  background: "var(--color-card)",
  border: "1px solid var(--color-border)",
  borderRadius: 6,
};
