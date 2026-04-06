/**
 * De-identification enforcement for HIPAA Safe Harbor compliance.
 *
 * - No patient name, MRN, DOB, SSN, address, or phone may be stored
 * - Ages > 89 are capped at 90
 * - Free text fields are capped at 500 characters
 * - Study IDs are system-generated UUIDs
 */

const FORBIDDEN_KEYS = new Set([
  "name", "patient_name", "full_name", "first_name", "last_name",
  "mrn", "medical_record", "medical_record_number",
  "dob", "date_of_birth", "birth_date", "birthday",
  "ssn", "social_security",
  "address", "street", "city", "state", "zip", "zipcode",
  "phone", "telephone", "cell", "mobile",
]);

const MAX_FREE_TEXT_LENGTH = 500;

export function assertNoIdentifiers(obj: Record<string, unknown>): void {
  for (const key of Object.keys(obj)) {
    if (FORBIDDEN_KEYS.has(key.toLowerCase())) {
      throw new Error(`De-identification violation: field "${key}" is not permitted in research records.`);
    }
  }
}

export function capAge(age: number): number {
  return age > 89 ? 90 : age;
}

export function capFreeText(text: string | null | undefined): string | null {
  if (!text) return null;
  return text.length > MAX_FREE_TEXT_LENGTH ? text.substring(0, MAX_FREE_TEXT_LENGTH) : text;
}
