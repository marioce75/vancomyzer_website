'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import type { TrialStatusResult } from '@/lib/trial/trialService'
import { COLIN_2019 } from '@/lib/pk/modelRegistry'

const GREEN = '#00d4aa'
const NAVY  = '#1C3A52'
const SLATE = '#3D5A73'

const FEATURES = [
  { label: 'AUC-guided calculations', free: true, pro: true },
  { label: 'Bayesian single & two-level estimation', free: true, pro: true },
  { label: `${COLIN_2019.shortName} PK model (every adult, every BMI)`, free: true, pro: true },
  { label: 'Pilot summary report PDF', free: true, pro: true },
  { label: 'Calculation history (90-day retention)', free: false, pro: true },
  { label: 'PDF export and clinical-note copy (free for everyone during launch)', free: false, pro: true },
  { label: 'Email support', free: false, pro: true },
]

export default function UpgradePage() {
  const [trialStatus, setTrialStatus] = useState<TrialStatusResult | null>(null)
  const [plan, setPlan] = useState<'annual'>('annual')
  const [renewalConsent, setRenewalConsent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/trial/status')
      .then(r => r.json())
      .then(data => setTrialStatus(data))
      .catch(() => {})
  }, [])

  const handleCheckout = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, renewalConsent }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        setError(data.error ?? 'Checkout failed. Please try again.')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const stats = trialStatus?.stats
  const isConverted = trialStatus?.isConverted

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '48px 24px', fontFamily: 'var(--font-sans, system-ui)' }}>

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', color: GREEN, marginBottom: 8 }}>
          VANCOMYZER™
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: NAVY, margin: '0 0 12px' }}>
          {isConverted ? 'You\'re already subscribed.' : 'Continue without interruption.'}
        </h1>
        <p style={{ fontSize: 15, color: SLATE, lineHeight: 1.6, maxWidth: 480, margin: '0 auto' }}>
          {isConverted
            ? 'Your case history is preserved and all Pro features are active.'
            : 'Subscribe before your pilot ends to retain your full case history and unlock Pro features.'}
        </p>
      </div>

      {/* Pilot stats summary */}
      {stats && stats.totalCases > 0 && (
        <div style={{ background: '#f0fdf9', border: `1px solid ${GREEN}40`, padding: '20px 24px', marginBottom: 36 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: NAVY, letterSpacing: '0.08em', marginBottom: 12 }}>YOUR PILOT IN NUMBERS</div>
          <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' as const }}>
            {[
              { label: 'Cases', value: stats.totalCases, sub: null as string | null },
              { label: 'AUC Attainment', value: stats.aucTargetAttainmentRate != null ? `${stats.aucTargetAttainmentRate.toFixed(0)}%` : '—', sub: null as string | null },
              { label: 'ICU Cases', value: stats.icuCases, sub: null as string | null },
            ].map(s => (
              <div key={s.label}>
                <div style={{ fontSize: 22, fontWeight: 700, color: GREEN, fontFamily: 'monospace' }}>{s.value}</div>
                <div style={{ fontSize: 11, color: SLATE, marginTop: 2 }}>{s.label}</div>{s.sub && <div style={{ fontSize: 9, color: SLATE, opacity: 0.7, marginTop: 1 }}>{s.sub}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {!isConverted && (
        <>
          {/* Plan selector */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 24, justifyContent: 'center' }}>
            {(['annual'] as const).map(p => (
              <button
                key={p}
                type="button"
                onClick={() => setPlan(p)}
                style={{
                  padding: '10px 28px',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: `2px solid ${plan === p ? GREEN : '#e2e8f0'}`,
                  background: plan === p ? GREEN : '#fff',
                  color: plan === p ? NAVY : SLATE,
                }}
              >
                $49.99 / year
                {p === 'annual' && (
                  <span style={{ display: 'block', fontSize: 10, fontWeight: 400, marginTop: 2 }}>
                    billed annually · cancel online
                  </span>
                )}
              </button>
            ))}
          </div>

          <label style={{ display: 'block', marginBottom: 20, fontSize: 14 }}>
            <input type="checkbox" checked={renewalConsent} onChange={e => setRenewalConsent(e.target.checked)} />{' '}
            I agree to automatic renewal: after the 14-day trial, $49.99 is charged yearly until I cancel online in Billing. Any verified discount is shown before payment. Cancel before the trial ends to avoid a charge; otherwise cancel before renewal to stop the next charge.
          </label>
          {/* CTA */}
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <button
              type="button"
              onClick={handleCheckout}
              disabled={loading || !renewalConsent}
              style={{
                background: GREEN, color: NAVY, border: 'none',
                padding: '14px 40px', fontSize: 15, fontWeight: 700,
                cursor: loading ? 'wait' : 'pointer',
                opacity: loading ? 0.7 : 1,
                letterSpacing: '0.04em',
              }}
            >
              {loading ? 'Redirecting to Checkout…' : 'Start 14-day trial — then $49.99/year'}
            </button>
            <div style={{ fontSize: 11, color: SLATE, marginTop: 8 }}>
              Secure checkout via Stripe · Cancel anytime
            </div>
            {error && (
              <div style={{ fontSize: 12, color: '#ef4444', marginTop: 8 }}>{error}</div>
            )}
          </div>
        </>
      )}

      {/* Feature comparison table */}
      <div style={{ border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px', background: NAVY, padding: '10px 20px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', letterSpacing: '0.08em' }}>FEATURE</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textAlign: 'center' as const }}>Free</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: GREEN, textAlign: 'center' as const }}>Pro</div>
        </div>
        {FEATURES.map((f, i) => (
          <div
            key={f.label}
            style={{
              display: 'grid', gridTemplateColumns: '1fr 80px 80px',
              padding: '10px 20px',
              background: i % 2 === 0 ? '#fff' : '#f8fafc',
              borderBottom: '1px solid #f1f5f9',
            }}
          >
            <div style={{ fontSize: 13, color: NAVY }}>{f.label}</div>
            <div style={{ textAlign: 'center' as const, fontSize: 14, color: f.free ? GREEN : '#cbd5e1' }}>
              {f.free ? '✓' : '—'}
            </div>
            <div style={{ textAlign: 'center' as const, fontSize: 14, color: f.pro ? GREEN : '#cbd5e1' }}>
              {f.pro ? '✓' : '—'}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 28, textAlign: 'center' as const }}>
        <Link href="/calculator" style={{ fontSize: 12, color: SLATE, textDecoration: 'none' }}>
          ← Back to Calculator
        </Link>
        {' · '}
        <Link href="/pricing" style={{ fontSize: 12, color: SLATE, textDecoration: 'none' }}>
          View all plans
        </Link>
      </div>
    </div>
  )
}
