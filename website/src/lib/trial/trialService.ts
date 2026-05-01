import {
  findTrialByUserId,
  createTrial,
  updateTrialPhase,
  updateTrialStatus,
  listTrialCases,
  insertTrialCase,
  findUserById,
  type TrialRow,
  type TrialCaseRow,
} from '@/lib/db'

export const TRIAL_DAYS = 90
export const PHASE_1_END = 14
export const PHASE_2_END = 75
export const REPORT_TRIGGER_DAY = 75

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000)
}

function differenceInDays(dateLeft: Date, dateRight: Date): number {
  return Math.floor((dateLeft.getTime() - dateRight.getTime()) / (24 * 60 * 60 * 1000))
}

export function getOrCreateTrial(userId: number): TrialRow {
  const existing = findTrialByUserId(userId)
  if (existing) return existing

  // Only create trials for approved users
  const user = findUserById(userId)
  if (!user || user.status !== 'active') throw new Error('User not eligible for trial')

  const startedAt = new Date()
  const expiresAt = addDays(startedAt, TRIAL_DAYS)
  return createTrial(userId, startedAt, expiresAt)
}

export interface TrialStatusResult {
  trial: TrialRow
  daysElapsed: number
  daysRemaining: number
  isExpired: boolean
  isConverted: boolean
  currentPhase: string
  reportReady: boolean
  stats: {
    totalCases: number
    obesityModelActivations: number
    aucTargetAttainmentRate: number | null
    icuCases: number
    twoLevelCases: number
    casesWithOutcome: number
  }
}

export function getTrialStatus(userId: number): TrialStatusResult | null {
  const trial = findTrialByUserId(userId)
  if (!trial) return null

  const today = new Date()
  const startedAt = new Date(trial.started_at)
  const expiresAt = new Date(trial.expires_at)

  const daysElapsed = differenceInDays(today, startedAt)
  const daysRemaining = Math.max(0, TRIAL_DAYS - daysElapsed)
  const isExpired = today > expiresAt
  const isConverted = trial.status === 'CONVERTED'

  let currentPhase = 'PHASE_1'
  if (daysElapsed >= PHASE_2_END) currentPhase = 'PHASE_3'
  else if (daysElapsed >= PHASE_1_END) currentPhase = 'PHASE_2'

  if (currentPhase !== trial.phase && !isExpired && !isConverted) {
    updateTrialPhase(userId, currentPhase)
  }

  if (isExpired && trial.status === 'ACTIVE') {
    updateTrialStatus(userId, 'EXPIRED')
  }

  const cases = listTrialCases(trial.id)
  const totalCases = cases.length
  const obesityModelActivations = cases.filter(c => c.obesity_model_used === 1).length
  const casesWithAucOutcome = cases.filter(c => c.auc_in_400_600 !== null)
  const aucTargetAttainmentRate = casesWithAucOutcome.length > 0
    ? (casesWithAucOutcome.filter(c => c.auc_in_400_600 === 1).length / casesWithAucOutcome.length) * 100
    : null
  const icuCases = cases.filter(c => c.icu_patient === 1).length
  const twoLevelCases = cases.filter(c => c.estimation_mode === 'two_level').length

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
      casesWithOutcome: casesWithAucOutcome.length,
    },
  }
}

export function logCase(userId: number, caseData: {
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
}): void {
  const trial = getOrCreateTrial(userId)
  insertTrialCase({
    trial_id: trial.id,
    user_id: userId,
    age_group: caseData.ageGroup,
    weight_category: caseData.weightCategory,
    bmi: caseData.bmi,
    obesity_model_used: caseData.obesityModelUsed ? 1 : 0,
    estimation_mode: caseData.estimationMode,
    indication_category: caseData.indicationCategory ?? null,
    icu_patient: caseData.icuPatient ? 1 : 0,
    target_auc_achieved: null,
    calculated_auc: caseData.calculatedAuc ?? null,
    auc_in_400_600: caseData.aucIn400_600 != null ? (caseData.aucIn400_600 ? 1 : 0) : null,
    recommended_dose: caseData.recommendedDose ?? null,
    recommended_interval: caseData.recommendedInterval ?? null,
    notes: null,
  })
}

export function getPhaseLabel(phase: string): string {
  const labels: Record<string, string> = {
    PHASE_1: 'Familiarization',
    PHASE_2: 'Active Use',
    PHASE_3: 'Value Review',
  }
  return labels[phase] ?? phase
}

export function getPhaseDescription(phase: string): string {
  const descriptions: Record<string, string> = {
    PHASE_1: 'Run Vancomyzer alongside your current workflow to get familiar with the platform.',
    PHASE_2: 'Use Vancomyzer as your primary dosing support tool. Your case data is building.',
    PHASE_3: 'Your pilot summary report is ready. Review your outcomes and share with your pharmacy director.',
  }
  return descriptions[phase] ?? ''
}
