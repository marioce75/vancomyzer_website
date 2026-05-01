import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { getOrCreateTrial, getTrialStatus } from '@/lib/trial/trialService'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as Record<string, unknown> | undefined)?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    getOrCreateTrial(Number(userId))
    const status = getTrialStatus(Number(userId))
    return NextResponse.json(status)
  } catch (err) {
    console.error('[trial/status]', err)
    return NextResponse.json({ error: 'Failed to load trial status' }, { status: 500 })
  }
}
