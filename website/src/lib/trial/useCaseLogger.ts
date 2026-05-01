'use client'

import { useSession } from 'next-auth/react'
import { useCallback } from 'react'

interface CaseLogPayload {
  bmi: number
  obesityModelUsed: boolean
  estimationMode: 'empiric' | 'single_level' | 'two_level'
  indicationCategory?: string
  icuPatient: boolean
  calculatedAuc?: number
  recommendedDose?: number
  recommendedInterval?: number
}

export function useCaseLogger() {
  const { data: session } = useSession()

  const logCase = useCallback(async (payload: CaseLogPayload) => {
    if (!session?.user) return

    const weightCategory =
      payload.bmi >= 40 ? 'morbidly_obese' :
      payload.bmi >= 30 ? 'obese' :
      payload.bmi >= 25 ? 'overweight' : 'normal'

    const aucIn400_600 = payload.calculatedAuc != null
      ? payload.calculatedAuc >= 400 && payload.calculatedAuc <= 600
      : undefined

    try {
      await fetch('/api/trial/log-case', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, weightCategory, aucIn400_600 }),
      })
    } catch {
      // Silent fail — never interrupt the clinical workflow
    }
  }, [session])

  return { logCase }
}
