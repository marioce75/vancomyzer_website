'use client'

import { useTrialStatus } from '@/hooks/useTrialStatus'

interface Props {
  feature: 'export' | 'multiuser' | 'research' | 'persistent_list'
  children: React.ReactNode
}

export function TrialFeatureGate({ feature, children }: Props) {
  const { status } = useTrialStatus()

  const allowed = status?.isConverted === true

  if (allowed) return <>{children}</>

  return (
    <div className="relative group">
      <div className="pointer-events-none opacity-40">{children}</div>
      <div
        className="absolute inset-0 flex items-center justify-center rounded"
        style={{ background: 'rgba(255,255,255,0.85)' }}
      >
        <button
          type="button"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold"
          style={{
            border: '1px solid #00d4aa',
            color: '#00d4aa',
            background: 'transparent',
            cursor: 'pointer',
          }}
          onClick={() => { window.location.href = '/upgrade' }}
        >
          🔒 Available with subscription
        </button>
      </div>
    </div>
  )
}
