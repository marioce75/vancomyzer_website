# CLAUDE CODE PROMPT — Vancomyzer™ 90-Day Free Pilot System
## Dosys Health LLC · vancomyzer.com · Next.js 14 + TypeScript + Tailwind + shadcn/ui + NextAuth.js + Prisma + Stripe

---

## CONTEXT

You are building the complete 90-day free pilot system for Vancomyzer™, a Bayesian
AUC-guided vancomycin dosing calculator at vancomyzer.com. The codebase is located
at ~/vancomyzer_website. The stack is:

- Framework: Next.js 14 (App Router)
- Language: TypeScript
- Styling: Tailwind CSS + shadcn/ui components
- Auth: NextAuth.js (existing HCP attestation + admin approval workflow)
- Database ORM: Prisma
- Payments: Stripe (subscription management)
- Email: Resend (or existing mailer — check lib/email.ts)
- Deployment: Vercel

Brand tokens (already in globals.css or tailwind.config):
- Signal Green: #00d4aa
- Dark navy: #1C3A52
- Font: DM Serif Display (headings) / DM Sans (body) / DM Mono (code/equations)

Do NOT change the existing calculator logic, PK equations, or patient data structures.
Do NOT modify the HCP attestation flow or admin approval workflow.
Build alongside what exists. Import from existing shared components wherever possible.

---

## WHAT YOU ARE BUILDING

A complete 90-day free pilot system with these components:

1. **Trial state machine** — tracks each user through three phases
2. **Case logger** — records every patient calculation automatically
3. **Pilot dashboard** — user-facing analytics panel showing their trial progress
4. **Day-75 summary report** — auto-generated PDF the user can download and share
5. **Feature gates** — paywall logic for post-trial premium features
6. **Email notifications** — phase transitions, summary report ready, trial expiring
7. **Admin trial view** — Mario can see all active pilots and conversion status
8. **Upgrade flow** — Stripe checkout triggered from trial expiry and dashboard

---

## STEP 1 — DATABASE SCHEMA (Prisma)

Open `prisma/schema.prisma`. Add the following models without removing any existing ones.

```prisma
model Trial {
  id              String        @id @default(cuid())
  userId          String        @unique
  user            User          @relation(fields: [userId], references: [id])
  startedAt       DateTime      @default(now())
  expiresAt       DateTime      // startedAt + 90 days
  phase           TrialPhase    @default(PHASE_1)
  status          TrialStatus   @default(ACTIVE)
  reportGeneratedAt DateTime?
  reportUrl       String?       // path to generated PDF
  convertedAt     DateTime?
  stripeSessionId String?
  cases           TrialCase[]
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
}

model TrialCase {
  id                  String    @id @default(cuid())
  trialId             String
  trial               Trial     @relation(fields: [trialId], references: [id])
  userId              String
  loggedAt            DateTime  @default(now())

  // Patient demographics (de-identified — no PHI stored)
  ageGroup            String    // "18-40" | "41-60" | "61-80" | "80+"
  weightCategory      String    // "normal" | "overweight" | "obese" | "morbidly_obese"
  bmi                 Float
  obesityModelUsed    Boolean   @default(false)

  // Dosing context
  estimationMode      String    // "empiric" | "single_level" | "two_level"
  indicationCategory  String?   // "MRSA_bacteremia" | "pneumonia" | "ssti" | "other"
  icuPatient          Boolean   @default(false)

  // AUC outcome (user-entered or calculated)
  targetAucAchieved   Boolean?  // null if user did not enter outcome
  calculatedAuc       Float?
  aucIn400_600        Boolean?  // whether AUC fell in 400-600 range

  // Dose recommendation
  recommendedDose     Float?
  recommendedInterval Float?

  notes               String?
}

enum TrialPhase {
  PHASE_1   // Days 1-14: Parallel use, familiarization
  PHASE_2   // Days 15-75: Primary use, active data collection
  PHASE_3   // Days 76-90: Value summary, conversion window
}

enum TrialStatus {
  ACTIVE
  EXPIRED
  CONVERTED   // Became paid subscriber
  CHURNED     // Trial ended without conversion
}
```

After editing the schema, run:
```bash
npx prisma migrate dev --name add_trial_system
npx prisma generate
```

---

## STEP 2 — TRIAL SERVICE (Business Logic)

Create `lib/trial/trialService.ts`:

```typescript
// lib/trial/trialService.ts
// Core trial lifecycle management — all trial logic flows through here

import { prisma } from '@/lib/prisma'
import { TrialPhase, TrialStatus } from '@prisma/client'
import { addDays, differenceInDays, isAfter } from 'date-fns'

export const TRIAL_DAYS = 90
export const PHASE_1_END = 14
export const PHASE_2_END = 75
export const REPORT_TRIGGER_DAY = 75

export async function getOrCreateTrial(userId: string) {
  const existing = await prisma.trial.findUnique({
    where: { userId },
    include: { cases: true }
  })
  if (existing) return existing

  const startedAt = new Date()
  const expiresAt = addDays(startedAt, TRIAL_DAYS)

  return prisma.trial.create({
    data: { userId, startedAt, expiresAt, phase: TrialPhase.PHASE_1 },
    include: { cases: true }
  })
}

export async function getTrialStatus(userId: string) {
  const trial = await prisma.trial.findUnique({
    where: { userId },
    include: { cases: true }
  })
  if (!trial) return null

  const today = new Date()
  const daysElapsed = differenceInDays(today, trial.startedAt)
  const daysRemaining = Math.max(0, TRIAL_DAYS - daysElapsed)
  const isExpired = isAfter(today, trial.expiresAt)
  const isConverted = trial.status === TrialStatus.CONVERTED

  // Compute current phase
  let currentPhase: TrialPhase = TrialPhase.PHASE_1
  if (daysElapsed >= PHASE_2_END) currentPhase = TrialPhase.PHASE_3
  else if (daysElapsed >= PHASE_1_END) currentPhase = TrialPhase.PHASE_2

  // Auto-update phase in DB if it changed
  if (currentPhase !== trial.phase && !isExpired && !isConverted) {
    await prisma.trial.update({
      where: { userId },
      data: { phase: currentPhase }
    })
  }

  // Mark expired if needed
  if (isExpired && trial.status === TrialStatus.ACTIVE) {
    await prisma.trial.update({
      where: { userId },
      data: { status: TrialStatus.EXPIRED }
    })
  }

  const cases = trial.cases
  const totalCases = cases.length
  const obesityModelActivations = cases.filter(c => c.obesityModelUsed).length
  const casesWithAucOutcome = cases.filter(c => c.aucIn400_600 !== null)
  const aucTargetAttainmentRate = casesWithAucOutcome.length > 0
    ? (casesWithAucOutcome.filter(c => c.aucIn400_600).length / casesWithAucOutcome.length) * 100
    : null
  const icuCases = cases.filter(c => c.icuPatient).length
  const twoLevelCases = cases.filter(c => c.estimationMode === 'two_level').length

  const reportReady = daysElapsed >= REPORT_TRIGGER_DAY && !isExpired

  return {
    trial,
    daysElapsed,
    daysRemaining,
    isExpired,
    isConverted,
    currentPhase,
    reportReady,
    stats: {
      totalCases,
      obesityModelActivations,
      aucTargetAttainmentRate,
      icuCases,
      twoLevelCases,
      casesWithOutcome: casesWithAucOutcome.length
    }
  }
}

export async function logCase(userId: string, caseData: {
  ageGroup: string
  weightCategory: string
  bmi: number
  obesityModelUsed: boolean
  estimationMode: string
  indicationCategory?: string
  icuPatient: boolean
  calculatedAuc?: number
  aucIn400_600?: boolean
  recommendedDose?: number
  recommendedInterval?: number
}) {
  const trial = await getOrCreateTrial(userId)
  return prisma.trialCase.create({
    data: { ...caseData, trialId: trial.id, userId }
  })
}

export function getPhaseLabel(phase: TrialPhase): string {
  const labels: Record<TrialPhase, string> = {
    PHASE_1: 'Familiarization',
    PHASE_2: 'Active Use',
    PHASE_3: 'Value Review'
  }
  return labels[phase]
}

export function getPhaseDescription(phase: TrialPhase): string {
  const descriptions: Record<TrialPhase, string> = {
    PHASE_1: 'Run Vancomyzer alongside your current workflow to get familiar with the platform.',
    PHASE_2: 'Use Vancomyzer as your primary dosing support tool. Your case data is building.',
    PHASE_3: 'Your pilot summary report is ready. Review your outcomes and share with your pharmacy director.'
  }
  return descriptions[phase]
}
```

---

## STEP 3 — CASE LOGGING HOOK

Create `lib/trial/useCaseLogger.ts`. This hook is called automatically from the
existing calculator results component whenever a completed calculation is displayed.

```typescript
// lib/trial/useCaseLogger.ts
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

    // Derive ageGroup and weightCategory from raw values
    // These are passed in from the existing patient state
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
        body: JSON.stringify({
          ...payload,
          weightCategory,
          aucIn400_600,
          // ageGroup is derived server-side from session or passed explicitly
        })
      })
    } catch {
      // Silent fail — never interrupt the clinical workflow
    }
  }, [session])

  return { logCase }
}
```

Integrate this hook into the existing calculator results component. Find the component
that renders the final Bayesian estimation output (likely `components/calculator/Results.tsx`
or similar). Add this at the point where results are displayed:

```typescript
// Inside the existing results component, after results are calculated:
const { logCase } = useCaseLogger()

useEffect(() => {
  if (results && patientData) {
    logCase({
      bmi: patientData.bmi,
      obesityModelUsed: patientData.bmi >= 40,
      estimationMode: currentMode, // 'empiric' | 'single_level' | 'two_level'
      icuPatient: patientData.isBedboundICU ?? false,
      calculatedAuc: results.aucEstimate,
      recommendedDose: results.recommendedDose,
      recommendedInterval: results.recommendedInterval,
    })
  }
}, [results])
```

---

## STEP 4 — API ROUTES

Create the following API routes under `app/api/trial/`:

### `app/api/trial/status/route.ts`
Returns current trial status for the authenticated user.

```typescript
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getTrialStatus, getOrCreateTrial } from '@/lib/trial/trialService'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Create trial on first access (trial starts when user first reaches the calculator)
  await getOrCreateTrial(session.user.id)
  const status = await getTrialStatus(session.user.id)
  return NextResponse.json(status)
}
```

### `app/api/trial/log-case/route.ts`
Logs a completed calculation. Never throws — errors are swallowed to protect clinical flow.

```typescript
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { logCase } from '@/lib/trial/trialService'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ ok: false })

    const body = await req.json()
    // Derive ageGroup server-side if not provided
    const ageGroup = body.ageGroup ?? 'unknown'
    await logCase(session.user.id, { ...body, ageGroup })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false })
  }
}
```

### `app/api/trial/generate-report/route.ts`
Triggers PDF generation of the pilot summary report. Called from the dashboard
when the user clicks "Generate My Report" (available from day 75 onward).

```typescript
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getTrialStatus } from '@/lib/trial/trialService'
import { generatePilotReport } from '@/lib/trial/reportGenerator'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const status = await getTrialStatus(session.user.id)
  if (!status) return NextResponse.json({ error: 'No trial found' }, { status: 404 })
  if (!status.reportReady) return NextResponse.json({ error: 'Report not yet available' }, { status: 403 })

  const reportUrl = await generatePilotReport(session.user.id, status)

  await prisma.trial.update({
    where: { userId: session.user.id },
    data: { reportGeneratedAt: new Date(), reportUrl }
  })

  return NextResponse.json({ reportUrl })
}
```

---

## STEP 5 — PDF REPORT GENERATOR

Create `lib/trial/reportGenerator.ts`.

Use the `pdf-lib` npm package for PDF generation (install if not present:
`npm install pdf-lib`).

The report must be a clean, one-to-two page professional PDF that a pharmacist
can hand to their pharmacy director. Design it to match the Dosys Health brand:
Signal Green (#00d4aa), Navy (#1C3A52), Georgia or a clean sans-serif embedded font.

```typescript
// lib/trial/reportGenerator.ts
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

// Helper: convert hex to rgb (0-1 scale)
const hex = (h: string) => {
  const r = parseInt(h.slice(1,3),16)/255
  const g = parseInt(h.slice(3,5),16)/255
  const b = parseInt(h.slice(5,7),16)/255
  return rgb(r, g, b)
}

const GREEN = hex('#00d4aa')
const NAVY  = hex('#1C3A52')
const SLATE = hex('#3D5A73')
const WHITE = rgb(1, 1, 1)
const LIGHT = hex('#F7FBFA')

export async function generatePilotReport(
  userId: string,
  status: Awaited<ReturnType<typeof import('./trialService').getTrialStatus>>
): Promise<string> {
  if (!status) throw new Error('No trial status')

  const { stats, trial, daysElapsed } = status
  const userName = trial.user?.name ?? 'Vancomyzer User'
  const institution = trial.user?.institution ?? 'Your Institution'
  const generatedDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  })

  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([612, 792]) // US Letter
  const { width, height } = page.getSize()

  const fontBold   = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const fontReg    = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontObliq  = await pdfDoc.embedFont(StandardFonts.HelveticaOblique)

  // ── Navy header band ───────────────────────────────────────────────────────
  page.drawRectangle({ x: 0, y: height - 110, width, height: 110, color: NAVY })

  // Green accent bar under header
  page.drawRectangle({ x: 0, y: height - 116, width, height: 6, color: GREEN })

  // Header text
  page.drawText('VANCOMYZER™', { x: 40, y: height - 40, size: 9, font: fontBold, color: GREEN })
  page.drawText('90-Day Pilot Summary Report', { x: 40, y: height - 58, size: 20, font: fontBold, color: WHITE })
  page.drawText(`Prepared for: ${userName}  ·  ${institution}`, { x: 40, y: height - 80, size: 10, font: fontReg, color: rgb(0.7, 0.9, 0.85) })
  page.drawText(`Generated: ${generatedDate}  ·  Pilot Day ${daysElapsed} of 90`, { x: 40, y: height - 96, size: 9, font: fontReg, color: rgb(0.6, 0.8, 0.75) })

  // ── Section: What you accomplished ────────────────────────────────────────
  let y = height - 148

  page.drawText('Your Pilot at a Glance', { x: 40, y, size: 14, font: fontBold, color: NAVY })
  y -= 6
  page.drawLine({ start: { x: 40, y }, end: { x: 572, y }, thickness: 1.5, color: GREEN })
  y -= 24

  // Stat boxes — four across
  const statBoxes = [
    { label: 'Patients Dosed', value: stats.totalCases.toString(), sub: 'total cases logged' },
    { label: 'AUC Target Attainment', value: stats.aucTargetAttainmentRate != null ? `${stats.aucTargetAttainmentRate.toFixed(0)}%` : 'N/A', sub: 'of cases with outcome data' },
    { label: 'Obesity Model', value: stats.obesityModelActivations.toString(), sub: 'auto-activations (BMI ≥40)' },
    { label: 'ICU Patients', value: stats.icuCases.toString(), sub: 'critical care cases' },
  ]

  const boxW = 121, boxH = 72, boxGap = 10
  statBoxes.forEach((box, i) => {
    const x = 40 + i * (boxW + boxGap)
    page.drawRectangle({ x, y: y - boxH, width: boxW, height: boxH, color: LIGHT })
    page.drawRectangle({ x, y: y - boxH, width: boxW, height: 3, color: GREEN })
    page.drawText(box.value, { x: x + 12, y: y - 30, size: 22, font: fontBold, color: NAVY })
    page.drawText(box.label, { x: x + 12, y: y - 46, size: 8, font: fontBold, color: SLATE })
    page.drawText(box.sub, { x: x + 12, y: y - 58, size: 7, font: fontReg, color: SLATE })
  })
  y -= boxH + 28

  // ── Section: What the data shows ──────────────────────────────────────────
  page.drawText('What the Data Shows', { x: 40, y, size: 14, font: fontBold, color: NAVY })
  y -= 6
  page.drawLine({ start: { x: 40, y }, end: { x: 572, y }, thickness: 1.5, color: GREEN })
  y -= 20

  const insights: string[] = []

  if (stats.totalCases >= 20) {
    insights.push(`Over ${stats.totalCases} vancomycin cases were processed through Bayesian AUC-guided dosing during this pilot.`)
  } else if (stats.totalCases > 0) {
    insights.push(`${stats.totalCases} vancomycin cases were processed through Bayesian AUC-guided dosing during this pilot.`)
  }

  if (stats.aucTargetAttainmentRate != null) {
    insights.push(`AUC target attainment (400–600 mg·h/L) was achieved in ${stats.aucTargetAttainmentRate.toFixed(0)}% of cases with documented outcomes, reflecting direct alignment with the 2020 ASHP/IDSA consensus guidelines.`)
  }

  if (stats.obesityModelActivations > 0) {
    insights.push(`The Vancomyzer™ Obesity Model (FFM-based, BMI ≥40) was automatically activated ${stats.obesityModelActivations} time${stats.obesityModelActivations !== 1 ? 's' : ''} — providing pharmacologically appropriate dosing for patients in whom total body weight-based models have known systematic bias.`)
  }

  if (stats.twoLevelCases > 0) {
    insights.push(`${stats.twoLevelCases} cases used two-level Bayesian MAP estimation, enabling individualized pharmacokinetic parameter refinement after initial level results.`)
  }

  if (stats.icuCases > 0) {
    insights.push(`${stats.icuCases} ICU patients were dosed, a population at elevated risk of vancomycin-associated nephrotoxicity where AUC-guided dosing has the greatest demonstrated clinical impact.`)
  }

  if (insights.length === 0) {
    insights.push('Continue using Vancomyzer™ to build your outcome dataset. Richer data produces a more meaningful report.')
  }

  insights.forEach(text => {
    // Word-wrap at ~90 chars
    const maxW = 532
    const words = text.split(' ')
    let line = ''
    const lines: string[] = []
    words.forEach(w => {
      const test = line + (line ? ' ' : '') + w
      const testW = fontReg.widthOfTextAtSize(test, 10)
      if (testW > maxW && line) { lines.push(line); line = w }
      else line = test
    })
    if (line) lines.push(line)

    // Bullet
    page.drawText('–', { x: 40, y: y - 2, size: 10, font: fontBold, color: GREEN })
    lines.forEach((l, li) => {
      page.drawText(l, { x: 54, y: y - li * 14, size: 10, font: fontReg, color: NAVY })
    })
    y -= lines.length * 14 + 8
  })

  y -= 16

  // ── Section: Clinical context ──────────────────────────────────────────────
  page.drawText('Clinical Context', { x: 40, y, size: 14, font: fontBold, color: NAVY })
  y -= 6
  page.drawLine({ start: { x: 40, y }, end: { x: 572, y }, thickness: 1.5, color: GREEN })
  y -= 18

  const context = [
    'The 2020 ASHP/IDSA/PIDS/SIDP consensus guidelines mandate AUC₂₄-guided vancomycin monitoring with Bayesian software as the preferred method, targeting AUC₂₄/MIC of 400–600 mg·h/L.',
    'Trough-based monitoring is associated with AKI rates as high as 19%. AUC-guided dosing reduces nephrotoxicity risk — particularly relevant for ICU and high-comorbidity populations.',
    'Vancomyzer™ is the only transparent, open-source Bayesian dosing platform displaying all PK equations with DOI-linked citations at the point of care.',
  ]

  context.forEach(text => {
    const words = text.split(' ')
    let line = ''
    const lines: string[] = []
    words.forEach(w => {
      const test = line + (line ? ' ' : '') + w
      if (fontReg.widthOfTextAtSize(test, 9) > 532 && line) { lines.push(line); line = w }
      else line = test
    })
    if (line) lines.push(line)
    page.drawText('·', { x: 40, y: y - 1, size: 10, font: fontBold, color: GREEN })
    lines.forEach((l, li) => {
      page.drawText(l, { x: 52, y: y - li * 12, size: 9, font: fontReg, color: SLATE })
    })
    y -= lines.length * 12 + 8
  })

  y -= 16

  // ── Section: Next steps ────────────────────────────────────────────────────
  page.drawRectangle({ x: 0, y: y - 72, width, height: 72, color: LIGHT })
  page.drawRectangle({ x: 0, y: y - 72, width: 4, height: 72, color: GREEN })

  page.drawText('Ready to Continue?', { x: 20, y: y - 18, size: 13, font: fontBold, color: NAVY })
  page.drawText('Subscribe to Vancomyzer™ to retain your full case history, unlock multi-user access,', { x: 20, y: y - 34, size: 9, font: fontReg, color: SLATE })
  page.drawText('and continue AUC-guided dosing with no interruption to your clinical workflow.', { x: 20, y: y - 46, size: 9, font: fontReg, color: SLATE })
  page.drawText('Visit vancomyzer.com/upgrade to get started.', { x: 20, y: y - 60, size: 9, font: fontBold, color: GREEN })

  // ── Footer ────────────────────────────────────────────────────────────────
  page.drawLine({ start: { x: 40, y: 36 }, end: { x: 572, y: 36 }, thickness: 0.5, color: hex('#C8DDD8') })
  page.drawText('Vancomyzer™ is a product of Dosys Health LLC · McAllen, Texas · dosys.health · mario@dosys.health', { x: 40, y: 22, size: 7.5, font: fontReg, color: SLATE })
  page.drawText('This report is generated from anonymized case logs collected during the free pilot period. It does not contain patient identifiers.', { x: 40, y: 12, size: 6.5, font: fontObliq, color: SLATE })

  // ── Save PDF ───────────────────────────────────────────────────────────────
  const pdfBytes = await pdfDoc.save()
  const dir = path.join(process.cwd(), 'public', 'reports')
  await mkdir(dir, { recursive: true })
  const filename = `pilot-report-${userId}-${Date.now()}.pdf`
  const filepath = path.join(dir, filename)
  await writeFile(filepath, pdfBytes)

  return `/reports/${filename}`
}
```

---

## STEP 6 — PILOT DASHBOARD PAGE

Create `app/dashboard/pilot/page.tsx`.

This is the main user-facing pilot dashboard. It must:
- Match Vancomyzer's existing EMR-aesthetic dark/light design
- Use Signal Green (#00d4aa) and Navy (#1C3A52) brand colors
- Use DM Serif Display / DM Sans fonts (already loaded)
- Use shadcn/ui Card, Progress, Badge, Button components
- Show a phase timeline at the top
- Show the four stat cards
- Show a phase-specific instruction panel
- Show the Generate Report button (visible from day 75)
- Show the Upgrade button (visible from day 76 or when expired)
- Be fully responsive

```tsx
// app/dashboard/pilot/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { FileText, TrendingUp, Users, Activity, Download, CreditCard, CheckCircle, Clock, BarChart3 } from 'lucide-react'

// Fetch trial status from /api/trial/status
// Fetch case stats from same endpoint
// Render full pilot dashboard

export default function PilotDashboardPage() {
  const [status, setStatus] = useState<any>(null)
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

  const handleUpgrade = () => {
    window.location.href = '/upgrade'
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-pulse text-[#00d4aa] font-mono text-sm">Loading pilot data...</div>
    </div>
  )

  if (!status) return (
    <div className="p-8 text-center text-muted-foreground">No trial data found.</div>
  )

  const { daysElapsed, daysRemaining, currentPhase, stats, reportReady, isExpired, isConverted } = status

  // Phase definitions
  const phases = [
    { key: 'PHASE_1', label: 'Phase 1', subtitle: 'Familiarization', days: '1–14', done: daysElapsed >= 14 },
    { key: 'PHASE_2', label: 'Phase 2', subtitle: 'Active Use', days: '15–75', done: daysElapsed >= 75 },
    { key: 'PHASE_3', label: 'Phase 3', subtitle: 'Value Review', days: '76–90', done: isExpired || isConverted },
  ]

  const statCards = [
    { icon: Users, label: 'Total Cases', value: stats.totalCases, sub: 'patients dosed', color: 'text-[#00d4aa]' },
    { icon: TrendingUp, label: 'AUC Target Attainment', value: stats.aucTargetAttainmentRate != null ? `${stats.aucTargetAttainmentRate.toFixed(0)}%` : '—', sub: 'of cases with outcomes', color: 'text-[#00d4aa]' },
    { icon: Activity, label: 'Obesity Model Used', value: stats.obesityModelActivations, sub: 'BMI ≥40 activations', color: 'text-[#00d4aa]' },
    { icon: BarChart3, label: 'ICU Patients', value: stats.icuCases, sub: 'critical care cases', color: 'text-[#00d4aa]' },
  ]

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 space-y-10">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-serif text-[#1C3A52] dark:text-white">
            Your 90-Day Pilot
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isExpired ? 'Your pilot has ended.' : isConverted ? 'You are a subscriber.' : `Day ${daysElapsed} of 90 · ${daysRemaining} days remaining`}
          </p>
        </div>
        <Badge
          variant="outline"
          className={`text-xs px-3 py-1 border ${
            isExpired ? 'border-red-400 text-red-400' :
            isConverted ? 'border-[#00d4aa] text-[#00d4aa]' :
            'border-[#00d4aa] text-[#00d4aa]'
          }`}
        >
          {isConverted ? 'Subscribed' : isExpired ? 'Expired' : `Phase ${currentPhase.split('_')[1]} Active`}
        </Badge>
      </div>

      {/* Progress bar */}
      {!isConverted && (
        <div className="space-y-2">
          <Progress value={(daysElapsed / 90) * 100} className="h-2 bg-slate-100" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Day 1 — Start</span>
            <span>Day 14 — Phase 2</span>
            <span>Day 75 — Report Ready</span>
            <span>Day 90 — End</span>
          </div>
        </div>
      )}

      {/* Phase timeline */}
      <div className="grid grid-cols-3 gap-4">
        {phases.map((phase) => (
          <Card
            key={phase.key}
            className={`border transition-all ${
              currentPhase === phase.key && !isExpired
                ? 'border-[#00d4aa] shadow-sm'
                : phase.done ? 'border-slate-200 opacity-70' : 'border-slate-200'
            }`}
          >
            <CardContent className="pt-5 pb-4 px-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {phase.label}
                </span>
                {phase.done && <CheckCircle size={14} className="text-[#00d4aa]" />}
                {currentPhase === phase.key && !phase.done && (
                  <Clock size={14} className="text-[#00d4aa] animate-pulse" />
                )}
              </div>
              <div className="text-[#1C3A52] dark:text-white font-medium text-sm">{phase.subtitle}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Days {phase.days}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Phase instruction panel */}
      <Card className="border-l-4 border-l-[#00d4aa] border-t-0 border-r-0 border-b-0 rounded-l-none bg-[#F7FBFA] dark:bg-slate-900/50">
        <CardContent className="py-5 px-6">
          {currentPhase === 'PHASE_1' && !isExpired && (
            <>
              <div className="font-medium text-[#1C3A52] dark:text-white text-sm mb-1">Phase 1 — Familiarization (Days 1–14)</div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Run Vancomyzer alongside your current workflow. You do not need to change how you practice yet.
                Every case you calculate is being logged automatically, building your personal outcome dataset.
                Focus on learning where the calculator adds value for your most complex patients — obesity,
                renal dysfunction, ICU cases.
              </p>
            </>
          )}
          {currentPhase === 'PHASE_2' && !isExpired && (
            <>
              <div className="font-medium text-[#1C3A52] dark:text-white text-sm mb-1">Phase 2 — Active Use (Days 15–75)</div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Use Vancomyzer as your primary dosing support tool. Your case data is accumulating.
                At day 75, a personalized summary report will be generated showing your AUC attainment rate,
                obesity model activations, and key clinical insights — a document you can share directly
                with your pharmacy director to make the case for an institutional subscription.
              </p>
            </>
          )}
          {(currentPhase === 'PHASE_3' || isExpired) && !isConverted && (
            <>
              <div className="font-medium text-[#1C3A52] dark:text-white text-sm mb-1">Phase 3 — Value Review (Days 76–90)</div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Your pilot data is complete. Generate your personalized summary report below and share it
                with your pharmacy director or pharmacy and therapeutics committee. Your case history,
                AUC attainment data, and obesity model usage are all documented. Subscribe before day 90
                to retain your full case log and continue without interruption.
              </p>
            </>
          )}
          {isConverted && (
            <p className="text-sm text-[#00d4aa]">You are an active subscriber. Your case history is fully preserved.</p>
          )}
        </CardContent>
      </Card>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map(({ icon: Icon, label, value, sub, color }) => (
          <Card key={label} className="border border-slate-200">
            <CardContent className="pt-5 pb-4 px-5">
              <Icon size={16} className={`mb-3 ${color}`} />
              <div className={`text-2xl font-bold font-mono ${color}`}>{value}</div>
              <div className="text-xs font-medium text-[#1C3A52] dark:text-white mt-0.5">{label}</div>
              <div className="text-xs text-muted-foreground">{sub}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Action buttons */}
      <div className="flex flex-col sm:flex-row gap-4">
        {reportReady && !isConverted && (
          <Button
            onClick={handleGenerateReport}
            disabled={reportLoading}
            className="bg-[#1C3A52] hover:bg-[#16304A] text-white gap-2"
          >
            <FileText size={16} />
            {reportLoading ? 'Generating...' : reportUrl ? 'Re-generate Report' : 'Generate My Pilot Report'}
          </Button>
        )}
        {reportUrl && (
          <Button
            variant="outline"
            className="border-[#00d4aa] text-[#00d4aa] hover:bg-[#00d4aa]/10 gap-2"
            onClick={() => window.open(reportUrl, '_blank')}
          >
            <Download size={16} />
            Download Report PDF
          </Button>
        )}
        {(isExpired || currentPhase === 'PHASE_3') && !isConverted && (
          <Button
            onClick={handleUpgrade}
            className="bg-[#00d4aa] hover:bg-[#00c49c] text-[#1C3A52] font-semibold gap-2"
          >
            <CreditCard size={16} />
            Subscribe — $19/mo or $149/yr
          </Button>
        )}
      </div>

      {/* Feature gate explanation */}
      {!isConverted && (
        <Card className="border border-dashed border-slate-300">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-[#1C3A52] dark:text-white">
              What is included after the pilot
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-1.5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1.5">
              {[
                ['Full case history export (CSV)', true],
                ['Pilot summary report PDF', true],
                ['Multi-user institutional access', false],
                ['Persistent patient list', false],
                ['Research mode + NONMEM export', false],
                ['Priority clinical support', false],
              ].map(([feature, included]) => (
                <div key={feature as string} className="flex items-center gap-2">
                  <span className={included ? 'text-[#00d4aa]' : 'text-slate-400'}>
                    {included ? '✓' : '→'}
                  </span>
                  <span>{feature as string}</span>
                  {!included && <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-[#00d4aa]/50 text-[#00d4aa]">Pro</Badge>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
```

---

## STEP 7 — EMAIL NOTIFICATIONS

Create `lib/trial/trialEmails.ts`.

Use the existing email utility in `lib/email.ts` (or Resend if that is what is
configured). Send three automated emails:

```typescript
// lib/trial/trialEmails.ts

import { sendEmail } from '@/lib/email'  // use existing mailer

export async function sendPhase2Email(user: { email: string; name: string }) {
  await sendEmail({
    to: user.email,
    subject: 'Vancomyzer™ — You have reached Phase 2 of your pilot',
    html: `
      <p>Hi ${user.name},</p>
      <p>You are now in <strong>Phase 2</strong> of your 90-day Vancomyzer™ pilot — the active use phase.</p>
      <p>Every patient you run through the calculator is being logged. At day 75, a personalized
      summary report will be generated showing your AUC attainment rate, obesity model activations,
      and key clinical outcomes — a document you can share with your pharmacy director.</p>
      <p>Keep using Vancomyzer™ as your primary dosing support tool.</p>
      <p>— The Dosys Health LLC Team<br>mario@dosys.health</p>
    `
  })
}

export async function sendReportReadyEmail(user: { email: string; name: string }) {
  await sendEmail({
    to: user.email,
    subject: 'Vancomyzer™ — Your pilot summary report is ready',
    html: `
      <p>Hi ${user.name},</p>
      <p>You have reached day 75 of your Vancomyzer™ pilot. <strong>Your personalized summary report is ready to generate.</strong></p>
      <p>The report documents your AUC target attainment rate, obesity model activations, and case volume —
      everything you need to make the case for an institutional subscription to your pharmacy director.</p>
      <p><a href="https://vancomyzer.com/dashboard/pilot" style="color:#00d4aa;font-weight:bold;">
        Generate my report →
      </a></p>
      <p>You have 15 days remaining in your free pilot.</p>
      <p>— The Dosys Health LLC Team</p>
    `
  })
}

export async function sendTrialExpiringEmail(user: { email: string; name: string }, daysLeft: number) {
  await sendEmail({
    to: user.email,
    subject: `Vancomyzer™ — ${daysLeft} days left in your free pilot`,
    html: `
      <p>Hi ${user.name},</p>
      <p>Your Vancomyzer™ free pilot ends in <strong>${daysLeft} days</strong>.</p>
      <p>Subscribe now to retain your full case history, unlock multi-user access, and continue
      AUC-guided dosing without interruption.</p>
      <p><a href="https://vancomyzer.com/upgrade" style="color:#00d4aa;font-weight:bold;">
        Subscribe — $19/mo or $149/yr →
      </a></p>
      <p>— The Dosys Health LLC Team</p>
    `
  })
}
```

Create a daily cron job or Vercel scheduled function at `app/api/cron/trial-notifications/route.ts`
that runs once per day to check all active trials and send phase transition emails as needed:

```typescript
// app/api/cron/trial-notifications/route.ts
// Secure this with CRON_SECRET env variable
import { prisma } from '@/lib/prisma'
import { differenceInDays } from 'date-fns'
import {
  sendPhase2Email,
  sendReportReadyEmail,
  sendTrialExpiringEmail
} from '@/lib/trial/trialEmails'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const trials = await prisma.trial.findMany({
    where: { status: 'ACTIVE' },
    include: { user: true }
  })

  for (const trial of trials) {
    const days = differenceInDays(new Date(), trial.startedAt)
    const user = { email: trial.user.email!, name: trial.user.name ?? 'Pharmacist' }

    if (days === 14) await sendPhase2Email(user)
    if (days === 75) await sendReportReadyEmail(user)
    if (days === 80 || days === 87 || days === 89) await sendTrialExpiringEmail(user, 90 - days)
  }

  return NextResponse.json({ processed: trials.length })
}
```

In `vercel.json`, add:
```json
{
  "crons": [{
    "path": "/api/cron/trial-notifications",
    "schedule": "0 9 * * *"
  }]
}
```

---

## STEP 8 — ADMIN TRIAL VIEW

Add a trial management tab to the existing admin panel
(likely at `app/admin/page.tsx` or `app/admin/dashboard/page.tsx`).

Add a new tab or section titled "Active Pilots" that shows a table with:
- User name and email
- Trial start date, days elapsed, current phase
- Total cases, AUC attainment rate, obesity model activations
- Status badge (Active / Phase 1-3 / Expired / Converted)
- Link to that user's pilot summary report if generated

API route: `app/api/admin/trials/route.ts`

```typescript
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { differenceInDays } from 'date-fns'

export async function GET() {
  const session = await getServerSession(authOptions)
  // Check admin role — use existing admin check pattern in your codebase
  if (!session?.user?.role || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const trials = await prisma.trial.findMany({
    include: {
      user: { select: { name: true, email: true } },
      cases: true
    },
    orderBy: { startedAt: 'desc' }
  })

  const data = trials.map(t => ({
    id: t.id,
    user: t.user,
    startedAt: t.startedAt,
    expiresAt: t.expiresAt,
    daysElapsed: differenceInDays(new Date(), t.startedAt),
    phase: t.phase,
    status: t.status,
    totalCases: t.cases.length,
    obesityActivations: t.cases.filter(c => c.obesityModelUsed).length,
    reportGenerated: !!t.reportUrl,
    reportUrl: t.reportUrl,
    convertedAt: t.convertedAt,
  }))

  return NextResponse.json(data)
}
```

---

## STEP 9 — FEATURE GATES

Create `lib/trial/featureGates.ts`. Import this wherever premium features are
rendered to conditionally show or gate content.

```typescript
// lib/trial/featureGates.ts
// Call getTrialStatus() and pass the result to these helpers

import { TrialStatus } from '@prisma/client'

export function canExportCaseHistory(trialStatus: any): boolean {
  return trialStatus?.isConverted === true
}

export function canAccessMultiUser(trialStatus: any): boolean {
  return trialStatus?.isConverted === true
}

export function canAccessResearchMode(trialStatus: any): boolean {
  return trialStatus?.isConverted === true
}

export function canUsePersistentPatientList(trialStatus: any): boolean {
  return trialStatus?.isConverted === true
}

export function canGenerateSummaryReport(trialStatus: any): boolean {
  return (trialStatus?.reportReady === true) || (trialStatus?.isConverted === true)
}

export function isTrialActive(trialStatus: any): boolean {
  return trialStatus?.trial?.status === TrialStatus.ACTIVE
}

export function isTrialExpired(trialStatus: any): boolean {
  return trialStatus?.isExpired === true && !trialStatus?.isConverted
}
```

For any gated UI element, wrap it with a `<FeatureGate>` component:

```tsx
// components/trial/FeatureGate.tsx
'use client'

import { useTrialStatus } from '@/hooks/useTrialStatus'
import { Button } from '@/components/ui/button'
import { Lock } from 'lucide-react'

interface Props {
  feature: 'export' | 'multiuser' | 'research' | 'persistent_list'
  children: React.ReactNode
}

export function FeatureGate({ feature, children }: Props) {
  const { status } = useTrialStatus()

  const allowed =
    feature === 'export'          ? status?.isConverted :
    feature === 'multiuser'       ? status?.isConverted :
    feature === 'research'        ? status?.isConverted :
    feature === 'persistent_list' ? status?.isConverted : false

  if (allowed) return <>{children}</>

  return (
    <div className="relative group">
      <div className="pointer-events-none opacity-40">{children}</div>
      <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-slate-900/80 rounded">
        <Button
          size="sm"
          variant="outline"
          className="border-[#00d4aa] text-[#00d4aa] gap-1.5 text-xs"
          onClick={() => window.location.href = '/upgrade'}
        >
          <Lock size={12} />
          Available with subscription
        </Button>
      </div>
    </div>
  )
}
```

Create the corresponding hook at `hooks/useTrialStatus.ts`:

```typescript
// hooks/useTrialStatus.ts
'use client'

import { useEffect, useState } from 'react'

export function useTrialStatus() {
  const [status, setStatus] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/trial/status')
      .then(r => r.json())
      .then(data => { setStatus(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return { status, loading }
}
```

---

## STEP 10 — NAVIGATION INTEGRATION

In the existing authenticated navigation (sidebar or top nav), add a link to the
pilot dashboard. The link should show the current phase and days remaining as a
subtle badge so the user always knows where they stand.

Find the existing nav component (likely `components/layout/Sidebar.tsx` or
`components/layout/Nav.tsx`) and add:

```tsx
import { useTrialStatus } from '@/hooks/useTrialStatus'

// Inside the nav component:
const { status } = useTrialStatus()

// Add nav item:
<NavItem
  href="/dashboard/pilot"
  icon={<BarChart3 size={16} />}
  label="My Pilot"
  badge={
    status && !status.isConverted && !status.isExpired
      ? `Day ${status.daysElapsed}`
      : status?.isConverted
      ? 'Pro'
      : status?.isExpired
      ? 'Expired'
      : null
  }
  badgeColor={
    status?.isConverted ? '#00d4aa' :
    status?.isExpired ? '#ef4444' : '#3D5A73'
  }
/>
```

---

## STEP 11 — UPGRADE PAGE

Create `app/upgrade/page.tsx`.

A clean conversion page with:
- Summary of what the pilot proved (pulled from trial status)
- Pricing: $19/month or $149/year (saves ~35%)
- Feature comparison table: Free tier vs. Pro
- Stripe checkout button (use existing Stripe integration pattern in the codebase)
- Testimonial placeholder for future social proof

The upgrade flow should:
1. Create a Stripe checkout session at `/api/stripe/create-checkout`
2. On successful payment, webhook at `/api/stripe/webhook` updates the Trial
   record: `status = CONVERTED`, `convertedAt = new Date()`, sets the user's
   subscription tier in the User model

---

## FINAL STEPS

1. Run `npx prisma migrate dev` to apply schema changes
2. Run `npm run dev` and verify:
   - `/dashboard/pilot` loads without error for an authenticated user
   - A trial record is created on first load
   - The case logger fires silently after a calculation
   - The Generate Report button appears at day 75 (to test: set `startedAt` 75 days back in DB)
   - The PDF report downloads correctly and contains real stat values
3. Run `npm run build` and fix any TypeScript errors before committing
4. Deploy to Vercel: `vercel --prod`
5. In Vercel dashboard, set env vars:
   - `CRON_SECRET` — a random secret string for the daily notification cron
   - Verify `NEXTAUTH_SECRET`, `DATABASE_URL`, `STRIPE_SECRET_KEY` are present

---

## HOW TO ACCESS THE PILOT DASHBOARD (User Instructions)

Once deployed, add these instructions to the Vancomyzer FAQ and onboarding email:

---

**Accessing your pilot dashboard:**

1. Log in to vancomyzer.com with your approved HCP account
2. In the left sidebar (or top navigation), click **"My Pilot"**
3. Your dashboard shows:
   - Which phase you are in and how many days remain
   - Total cases calculated, AUC attainment rate, obesity model activations
   - A phase-specific guidance panel telling you what to focus on right now

**Generating your summary report (available from Day 75):**

1. Go to **My Pilot** in the navigation
2. When you reach Day 75, the **"Generate My Pilot Report"** button becomes active
3. Click it — the report generates in seconds
4. Click **"Download Report PDF"** to save it
5. Share this PDF with your pharmacy director or P&T committee

**Subscribing after the pilot:**

1. Click **"Subscribe"** on the pilot dashboard or go to vancomyzer.com/upgrade
2. Choose monthly ($19/mo) or annual ($149/yr)
3. Complete checkout via Stripe — your case history is immediately preserved
4. Multi-user access and all Pro features unlock instantly

---

## IMPORTANT NOTES FOR CLAUDE CODE

- NEVER store any patient PHI in TrialCase. Only aggregated, non-identifiable
  metadata is logged (BMI category, age group, ICU flag, AUC range).
- The case logger must NEVER throw or block the calculator UI. Use try/catch
  everywhere and fail silently.
- The report PDF is saved to /public/reports/ — in production, move this to
  Vercel Blob Storage or S3 and return a signed URL instead of a static path.
  Add a TODO comment wherever this change is needed.
- Respect the existing admin approval workflow — trial creation should only
  happen for users whose `approved` flag is true in the User model.
- Check ~/vancomyzer_website/CLAUDE.md for any repo-specific conventions before
  making changes.
