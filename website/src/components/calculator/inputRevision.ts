import { clinicalDraftReplacer } from '@/lib/parseClinicalNumber';
export interface InputRevision { key: string; revision: number }
/** Locale and presentation settings are deliberately absent from the clinical snapshot. */
export function nextInputRevision(previous: InputRevision, inputs: unknown): InputRevision {
  const key = JSON.stringify(inputs, clinicalDraftReplacer);
  return key === previous.key ? previous : { key, revision: previous.revision + 1 };
}
export function resultIsCurrent(resultRevision: number | null, currentRevision: number): boolean {
  return resultRevision !== null && resultRevision === currentRevision;
}
export function responseIsCurrent(sequence: number, latestSequence: number, submittedRevision: number, currentRevision: number): boolean {
  return sequence === latestSequence && resultIsCurrent(submittedRevision, currentRevision);
}
