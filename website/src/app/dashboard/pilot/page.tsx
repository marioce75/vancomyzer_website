'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { TrialStatusResult } from '@/lib/trial/trialService'

const GREEN = '#00d4aa'
const NAVY  = '#1C3A52'
const SLATE = '#3D5A73'

export default function PilotDashboardPage() {
  const [status, setStatus] = useState<TrialStatusResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [reportLoading, setReportLoading] = useState(false)
  const [reportUrl, setReportUrl] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/trial/status')
      .then(r => r.json())
      .then(data => { setStatus(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const handleGenerateReport = async () => {
    setReportLoading(true)
    try {
      const res = await fetch('/api/trial/generate-report', { method: 'POST' })
      const data = await res.json()
      if (data.reportUrl) setReportUrl(data.reportUrl)
    } finally {
      setReportLoading(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen" style={{ background: 'var(--color-bg, #0f1923)' }}>
      <span style={{ color: GREEN, fontFamily: 'monospace', fontSize: 13 }}>Loading pilot data…</span>
    </div>
  )

  if (!status) return (
    <div className="p-8 text-center" style={{ color: SLATE }}>No trial data found.</div>
  )

  const { daysElapsed, daysRemaining, currentPhase, stats, reportReady, isExpired, isConverted } = status
  const existingReport = status.trial.report_url

  const phases = [
    { key: 'PHASE_1', label: 'Phase 1', subtitle: 'Familiarization', days: '1–14', done: daysElapsed >= 14 },
    { key: 'PHASE_2', label: 'Phase 2', subtitle: 'Active Use', days: '15–75', done: daysElapsed >= 75 },
    { key: 'PHASE_3', label: 'Phase 3', subtitle: 'Value Review', days: '76–90', done: isExpired || isConverted },
  ]

  const statCards = [
    { label: 'Total Cases', value: stats.totalCases, sub: 'patients dosed' },
    { label: 'AUC Target Attainment', value: stats.aucTargetAttainmentRate != null ? `${stats.aucTargetAttainmentRate.toFixed(0)}%` : '—', sub: 'of cases with outcomes' },
    { label: 'Obesity Model', value: stats.obesityModelActivations, sub: 'BMI ≥40 activations' },
    { label: 'ICU Patients', value: stats.icuCases, sub: 'critical care cases' },
  ]

  const progressPct = Math.min(100, Math.round((daysElapsed / 90) * 100))

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 24px', fontFamily: 'var(--font-sans, system-ui)' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: NAVY, margin: 0 }}>Your 90-Day Pilot</h1>
          <p style={{ fontSize: 13, color: SLATE, marginTop: 4 }}>
            {isExpired ? 'Your pilot has ended.' : isConverted ? 'You are an active subscriber.' : `Day ${daysElapsed} of 90 · ${daysRemaining} days remaining`}
          </p>
        </div>
        <span style={{
          fontSize: 11, fontWeight: 700, padding: '4px 12px',
          border: `1px solid ${isExpired ? '#ef4444' : GREEN}`,
          color: isExpired ? '#ef4444' : GREEN,
          letterSpacing: '0.06em',
        }}>
          {isConverted ? 'SUBSCRIBED' : isExpired ? 'EXPIRED' : `PHASE ${currentPhase.split('_')[1]} ACTIVE`}
        </span>
      </div>

      {/* Progress bar */}
      {!isConverted && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progressPct}%`, background: GREEN, transition: 'width 0.6s ease' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: SLATE, marginTop: 6 }}>
            <span>Day 1 — Start</span>
            <span>Day 14 — Phase 2</span>
            <span>Day 75 — Report</span>
            <span>Day 90 — End</span>
          </div>
        </div>
      )}

      {/* Phase timeline */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 28 }}>
        {phases.map(phase => {
          const isActive = currentPhase === phase.key && !isExpired
          return (
            <div key={phase.key} style={{
              border: `1px solid ${isActive ? GREEN : '#e2e8f0'}`,
              padding: '16px 18px',
              background: isActive ? '#f0fdf9' : '#fff',
              opacity: phase.done && !isActive ? 0.7 : 1,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: SLATE, letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>
                  {phase.label}
                </span>
                {phase.done && <span style={{ color: GREEN, fontSize: 13 }}>✓</span>}
                {isActive && <span style={{ color: GREEN, fontSize: 13 }}>●</span>}
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: NAVY }}>{phase.subtitle}</div>
              <div style={{ fontSize: 11, color: SLATE, marginTop: 2 }}>Days {phase.days}</div>
            </div>
          )
        })}
      </div>

      {/* Phase instruction panel */}
      <div style={{
        borderLeft: `4px solid ${GREEN}`,
        background: '#f7fbfa',
        padding: '18px 22px',
        marginBottom: 28,
      }}>
        {currentPhase === 'PHASE_1' && !isExpired && (
          <>
            <div style={{ fontWeight: 600, color: NAVY, fontSize: 13, marginBottom: 6 }}>Phase 1 — Familiarization (Days 1–14)</div>
            <p style={{ fontSize: 13, color: SLATE, lineHeight: 1.6, margin: 0 }}>
              Run Vancomyzer alongside your current workflow. You do not need to change how you practice yet.
              Every case you calculate is being logged automatically. Focus on learning where the calculator
              adds value for your most complex patients — obesity, renal dysfunction, ICU cases.
            </p>
          </>
        )}
        {currentPhase === 'PHASE_2' && !isExpired && (
          <>
            <div style={{ fontWeight: 600, color: NAVY, fontSize: 13, marginBottom: 6 }}>Phase 2 — Active Use (Days 15–75)</div>
            <p style={{ fontSize: 13, color: SLATE, lineHeight: 1.6, margin: 0 }}>
              Use Vancomyzer as your primary dosing support tool. Your case data is accumulating.
              At day 75, a personalized summary report will be generated showing your AUC attainment rate,
              obesity model activations, and key clinical insights — a document you can share with your
              pharmacy director to make the case for an institutional subscription.
            </p>
          </>
        )}
        {(currentPhase === 'PHASE_3' || isExpired) && !isConverted && (
          <>
            <div style={{ fontWeight: 600, color: NAVY, fontSize: 13, marginBottom: 6 }}>Phase 3 — Value Review (Days 76–90)</div>
            <p style={{ fontSize: 13, color: SLATE, lineHeight: 1.6, margin: 0 }}>
              Your pilot data is complete. Generate your personalized summary report below and share it
              with your pharmacy director or P&T committee. Subscribe before day 90 to retain your full
              case log and continue without interruption.
            </p>
          </>
        )}
        {isConverted && (
          <p style={{ fontSize: 13, color: GREEN, margin: 0 }}>You are an active subscriber. Your case history is fully preserved.</p>
        )}
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 28 }}>
        {statCards.map(card => (
          <div key={card.label} style={{ border: '1px solid #e2e8f0', padding: '18px 16px', background: '#fff' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: GREEN, fontFamily: 'monospace', marginBottom: 4 }}>{card.value}</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: NAVY }}>{card.label}</div>
            <div style={{ fontSize: 11, color: SLATE, marginTop: 2 }}>{card.sub}</div>
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' as const, marginBottom: 32 }}>
        {reportReady && !isConverted && (
          <button
            type="button"
            onClick={handleGenerateReport}
            disabled={reportLoading}
            style={{
              background: NAVY, color: '#fff', border: 'none',
              padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: reportLoading ? 'wait' : 'pointer',
              opacity: reportLoading ? 0.7 : 1,
            }}
          >
            {reportLoading ? 'Generating…' : (reportUrl || existingReport) ? 'Re-generate Report' : 'Generate My Pilot Report'}
          </button>
        )}
        {(reportUrl || existingReport) && (
          <button
            type="button"
            onClick={() => window.open(reportUrl ?? existingReport ?? '', '_blank')}
            style={{
              background: 'transparent', color: GREEN, border: `1px solid ${GREEN}`,
              padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Download Report PDF
          </button>
        )}
        {(isExpired || currentPhase === 'PHASE_3') && !isConverted && (
          <a
            href="/upgrade"
            style={{
              display: 'inline-block', background: GREEN, color: NAVY,
              border: 'none', padding: '10px 20px', fontSize: 13, fontWeight: 700,
              cursor: 'pointer', textDecoration: 'none',
            }}
          >
            Subscribe — $19/mo or $149/yr
          </a>
        )}
      </div>

      {/* Feature comparison */}
      {!isConverted && (
        <div style={{ border: '1px dashed #cbd5e1', padding: '20px 24px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: NAVY, marginBottom: 12 }}>What is included after the pilot</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 32px' }}>
            {([
              ['Full case history export (CSV)', true],
              ['Multi-user institutional access', false],
              ['Pilot summary report PDF', true],
              ['Persistent patient list', false],
              ['Priority clinical support', false],
              ['Research mode + NONMEM export', false],
            ] as [string, boolean][]).map(([feature, included]) => (
              <div key={feature} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: SLATE }}>
                <span style={{ color: included ? GREEN : '#94a3b8', fontWeight: 700 }}>{included ? '✓' : '→'}</span>
                <span>{feature}</span>
                {!included && (
                  <span style={{ fontSize: 10, border: `1px solid ${GREEN}50`, color: GREEN, padding: '1px 6px' }}>Pro</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop: 24 }}>
        <Link href="/calculator" style={{ fontSize: 12, color: SLATE, textDecoration: 'none' }}>← Back to Calculator</Link>
      </div>
    </div>
  )
}
