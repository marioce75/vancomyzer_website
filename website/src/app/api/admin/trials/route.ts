import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { listAllTrials, listTrialCases } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await getServerSession(authOptions)
  const user = session?.user as Record<string, unknown> | undefined
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const trials = listAllTrials()

  const data = trials.map(t => {
    const cases = listTrialCases(t.id)
    const daysElapsed = Math.floor(
      (Date.now() - new Date(t.started_at).getTime()) / (24 * 60 * 60 * 1000)
    )
    const casesWithOutcome = cases.filter(c => c.auc_in_400_600 !== null)
    const aucRate = casesWithOutcome.length > 0
      ? Math.round(casesWithOutcome.filter(c => c.auc_in_400_600 === 1).length / casesWithOutcome.length * 100)
      : null

    return {
      id: t.id,
      user: { name: t.full_name, email: t.email },
      startedAt: t.started_at,
      expiresAt: t.expires_at,
      daysElapsed,
      phase: t.phase,
      status: t.status,
      totalCases: cases.length,
      obesityActivations: cases.filter(c => c.obesity_model_used === 1).length,
      aucTargetAttainmentRate: aucRate,
      reportGenerated: !!t.report_url,
      reportUrl: t.report_url,
      convertedAt: t.converted_at,
    }
  })

  return NextResponse.json(data)
}
