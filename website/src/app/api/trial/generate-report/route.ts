import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { getTrialStatus } from '@/lib/trial/trialService'
import { generatePilotReport } from '@/lib/trial/reportGenerator'
import { updateTrialReport } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function POST() {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as Record<string, unknown> | undefined)?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const uid = Number(userId)
  const status = getTrialStatus(uid)
  if (!status) return NextResponse.json({ error: 'No trial found' }, { status: 404 })
  if (!status.reportReady) return NextResponse.json({ error: 'Report not yet available' }, { status: 403 })

  try {
    const reportUrl = await generatePilotReport(uid, status)
    updateTrialReport(uid, reportUrl)
    return NextResponse.json({ reportUrl })
  } catch (err) {
    console.error('[trial/generate-report]', err)
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 })
  }
}
