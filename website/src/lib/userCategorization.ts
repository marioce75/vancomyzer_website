/**
 * Structured categorization fields collected at registration. These power
 * the new User Management dashboard's segments + filters (Phase 2).
 *
 * Stored on users table as:
 *   - country_code        ISO 3166-1 alpha-2 (e.g. "US", "GB", "CA")
 *   - institution_type    enum below
 *   - practice_setting    enum below
 *
 * All three are REQUIRED at registration going forward. Pre-existing users
 * are prompted to fill them on next login via the ProfileCompletionPrompt
 * component (backfill option (b) per Mario's decision).
 */

// ─── Countries ──────────────────────────────────────────────────────
// Ordered by likely Vancomyzer user volume (US first, then other major
// English-speaking healthcare markets, then top non-English markets).
// "Other" rolls up the long tail.

export interface CountryOption {
  code: string; // ISO 3166-1 alpha-2
  name: string;
}

export const COUNTRIES: CountryOption[] = [
  { code: "US", name: "United States" },
  { code: "CA", name: "Canada" },
  { code: "GB", name: "United Kingdom" },
  { code: "AU", name: "Australia" },
  { code: "IE", name: "Ireland" },
  { code: "NZ", name: "New Zealand" },
  { code: "IN", name: "India" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "ES", name: "Spain" },
  { code: "IT", name: "Italy" },
  { code: "NL", name: "Netherlands" },
  { code: "BE", name: "Belgium" },
  { code: "CH", name: "Switzerland" },
  { code: "AT", name: "Austria" },
  { code: "DK", name: "Denmark" },
  { code: "NO", name: "Norway" },
  { code: "SE", name: "Sweden" },
  { code: "FI", name: "Finland" },
  { code: "PT", name: "Portugal" },
  { code: "PL", name: "Poland" },
  { code: "JP", name: "Japan" },
  { code: "KR", name: "South Korea" },
  { code: "SG", name: "Singapore" },
  { code: "HK", name: "Hong Kong SAR" },
  { code: "PH", name: "Philippines" },
  { code: "MY", name: "Malaysia" },
  { code: "TH", name: "Thailand" },
  { code: "BR", name: "Brazil" },
  { code: "MX", name: "Mexico" },
  { code: "AR", name: "Argentina" },
  { code: "CL", name: "Chile" },
  { code: "CO", name: "Colombia" },
  { code: "ZA", name: "South Africa" },
  { code: "EG", name: "Egypt" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "IL", name: "Israel" },
  { code: "TR", name: "Turkey" },
  { code: "OTHER", name: "Other / not listed" },
];

export function isValidCountryCode(code: string | null | undefined): boolean {
  if (!code) return false;
  return COUNTRIES.some((c) => c.code === code);
}

export function getCountryName(code: string | null | undefined): string {
  if (!code) return "Unknown";
  return COUNTRIES.find((c) => c.code === code)?.name ?? code;
}

// ─── Institution type ──────────────────────────────────────────────

export type InstitutionType =
  | "hospital"
  | "academic_medical_center"
  | "health_system"
  | "clinic_outpatient"
  | "retail_pharmacy"
  | "independent_pharmacy"
  | "government_va_military"
  | "payer_insurance"
  | "pharma_industry"
  | "academia_research"
  | "student"
  | "independent_consultant"
  | "other";

export interface InstitutionTypeOption {
  code: InstitutionType;
  name: string;
}

export const INSTITUTION_TYPES: InstitutionTypeOption[] = [
  { code: "hospital", name: "Hospital" },
  { code: "academic_medical_center", name: "Academic medical center" },
  { code: "health_system", name: "Health system / IDN" },
  { code: "clinic_outpatient", name: "Clinic / outpatient" },
  { code: "retail_pharmacy", name: "Retail pharmacy (chain)" },
  { code: "independent_pharmacy", name: "Independent pharmacy" },
  { code: "government_va_military", name: "Government / VA / military" },
  { code: "payer_insurance", name: "Payer / insurance" },
  { code: "pharma_industry", name: "Pharmaceutical industry" },
  { code: "academia_research", name: "Academia / research" },
  { code: "student", name: "Student / trainee" },
  { code: "independent_consultant", name: "Independent consultant" },
  { code: "other", name: "Other" },
];

export function isValidInstitutionType(value: string | null | undefined): value is InstitutionType {
  if (!value) return false;
  return INSTITUTION_TYPES.some((t) => t.code === value);
}

export function getInstitutionTypeName(value: string | null | undefined): string {
  if (!value) return "Unknown";
  return INSTITUTION_TYPES.find((t) => t.code === value)?.name ?? value;
}

// ─── Practice setting ──────────────────────────────────────────────

export type PracticeSetting =
  | "inpatient"
  | "icu_critical_care"
  | "emergency_department"
  | "outpatient_ambulatory"
  | "transitional_care_snf"
  | "retail"
  | "infectious_disease_consult"
  | "academic_research"
  | "administrative"
  | "student"
  | "other";

export interface PracticeSettingOption {
  code: PracticeSetting;
  name: string;
}

export const PRACTICE_SETTINGS: PracticeSettingOption[] = [
  { code: "inpatient", name: "Inpatient / floor pharmacy" },
  { code: "icu_critical_care", name: "ICU / critical care" },
  { code: "emergency_department", name: "Emergency department" },
  { code: "outpatient_ambulatory", name: "Outpatient / ambulatory" },
  { code: "transitional_care_snf", name: "Transitional care / SNF" },
  { code: "retail", name: "Retail / community" },
  { code: "infectious_disease_consult", name: "Infectious disease / ASP" },
  { code: "academic_research", name: "Academic / research" },
  { code: "administrative", name: "Administrative / management" },
  { code: "student", name: "Student / trainee" },
  { code: "other", name: "Other" },
];

export function isValidPracticeSetting(value: string | null | undefined): value is PracticeSetting {
  if (!value) return false;
  return PRACTICE_SETTINGS.some((s) => s.code === value);
}

export function getPracticeSettingName(value: string | null | undefined): string {
  if (!value) return "Unknown";
  return PRACTICE_SETTINGS.find((s) => s.code === value)?.name ?? value;
}
