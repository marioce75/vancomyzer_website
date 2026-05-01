'use client'

import { useEffect, useState } from 'react'
import type { TrialStatusResult } from '@/lib/trial/trialService'

export function useTrialStatus() {
  const [status, setStatus] = useState<TrialStatusResult | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/trial/status')
      .then(r => r.json())
      .then(data => { setStatus(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return { status, loading }
}
