import type { TrialStatusResult } from './trialService'

export function canExportCaseHistory(trialStatus: TrialStatusResult | null): boolean {
  return trialStatus?.isConverted === true
}

export function canAccessMultiUser(trialStatus: TrialStatusResult | null): boolean {
  return trialStatus?.isConverted === true
}

export function canAccessResearchMode(trialStatus: TrialStatusResult | null): boolean {
  return trialStatus?.isConverted === true
}

export function canUsePersistentPatientList(trialStatus: TrialStatusResult | null): boolean {
  return trialStatus?.isConverted === true
}

export function canGenerateSummaryReport(trialStatus: TrialStatusResult | null): boolean {
  return (trialStatus?.reportReady === true) || (trialStatus?.isConverted === true)
}

export function isTrialActive(trialStatus: TrialStatusResult | null): boolean {
  return trialStatus?.trial?.status === 'ACTIVE'
}

export function isTrialExpired(trialStatus: TrialStatusResult | null): boolean {
  return trialStatus?.isExpired === true && !trialStatus?.isConverted
}
