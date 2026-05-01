import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { logCase } from '@/lib/trial/trialService'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as Record<string, unknown> | undefined)?.id
    if (!userId) return NextResponse.json({ ok: false })

    const body = await req.json()
    const ageGroup = body.ageGroup ?? 'unknown'

    logCase(Number(userId), {
      ageGroup,
      weightCategory: body.weightCategory ?? 'normal',
      bmi: typeof body.bmi === 'number' ? body.bmi : 0,
      obesityModelUsed: Boolean(body.obesityModelUsed),
      estimationMode: body.estimationMode ?? 'empiric',
      indicationCategory: body.indicationCategory,
      icuPatient: Boolean(body.icuPatient),
      calculatedAuc: typeof body.calculatedAuc === 'number' ? body.calculatedAuc : undefined,
      aucIn400_600: typeof body.aucIn400_600 === 'boolean' ? body.aucIn400_600 : undefined,
      recommendedDose: typeof body.recommendedDose === 'number' ? body.recommendedDose : undefined,
      recommendedInterval: typeof body.recommendedInterval === 'number' ? body.recommendedInterval : undefined,
    })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false })
  }
}
