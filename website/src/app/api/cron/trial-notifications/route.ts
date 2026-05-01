import { listAllActiveTrials } from '@/lib/db'
import {
  sendPhase2Email,
  sendReportReadyEmail,
  sendTrialExpiringEmail,
} from '@/lib/trial/trialEmails'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const trials = listAllActiveTrials()

  let processed = 0
  for (const trial of trials) {
    const startedAt = new Date(trial.started_at)
    const days = Math.floor((Date.now() - startedAt.getTime()) / (24 * 60 * 60 * 1000))
    const user = {
      email: trial.email ?? '',
      name: trial.full_name ?? 'Pharmacist',
    }
    if (!user.email) continue

    try {
      if (days === 14) await sendPhase2Email(user)
      if (days === 75) await sendReportReadyEmail(user)
      if (days === 80 || days === 87 || days === 89) await sendTrialExpiringEmail(user, 90 - days)
      processed++
    } catch (err) {
      console.error(`[cron/trial-notifications] failed for trial ${trial.id}:`, err)
    }
  }

  return NextResponse.json({ processed })
}
