/**
 * FHIR Client Utilities for Vancomyzer SMART on FHIR Integration.
 *
 * Provides helper functions for:
 * - Fetching patient demographics (age, weight)
 * - Fetching lab results (serum creatinine, vancomycin levels)
 * - Fetching medication orders (vancomycin dose, interval, infusion time)
 * - Authenticated FHIR API calls with token management
 *
 * FHIR Resources used:
 * - Patient: demographics, age, weight
 * - Observation: lab results (SCr, vancomycin levels)
 * - MedicationRequest / MedicationAdministration: vancomycin orders
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SmartContext {
  patientId: string;
  userId?: string;
  encounterId?: string;
  fhirServerUrl: string;
  accessToken: string;
  tokenExpiry?: number;
  refreshToken?: string;
}

export interface FhirPatientData {
  name?: string;
  birthDate?: string;
  age?: number;
  gender?: string;
  weight_kg?: number;
}

export interface FhirLabResult {
  code: string;
  display: string;
  value: number;
  unit: string;
  date: string;
  time_since_last_dose_hours?: number;
}

export interface FhirMedicationOrder {
  drug: string;
  dose_mg?: number;
  interval_hours?: number;
  infusion_duration_hours?: number;
  route?: string;
  status: string;
  authored: string;
}

// ---------------------------------------------------------------------------
// SMART Configuration
// ---------------------------------------------------------------------------

export interface SmartAppConfig {
  clientId: string;
  redirectUri: string;
  scope: string;
}

export const DEFAULT_SMART_CONFIG: SmartAppConfig = {
  clientId: process.env.NEXT_PUBLIC_SMART_CLIENT_ID ?? "vancomyzer-smart-app",
  redirectUri: process.env.NEXT_PUBLIC_SMART_REDIRECT_URI ?? "/callback",
  scope: "launch patient/*.read user/*.read openid fhirUser offline_access",
};

// ---------------------------------------------------------------------------
// LOINC Codes for Vancomycin-Relevant Labs
// ---------------------------------------------------------------------------

export const LOINC = {
  SERUM_CREATININE: "2160-0",
  VANCOMYCIN_LEVEL: "4090-7",         // Vancomycin [Mass/volume] in Serum or Plasma
  VANCOMYCIN_TROUGH: "20578-1",       // Vancomycin [Mass/volume] in Serum or Plasma --trough
  VANCOMYCIN_PEAK: "20579-9",         // Vancomycin [Mass/volume] in Serum or Plasma --peak
  BODY_WEIGHT: "29463-7",
  BODY_HEIGHT: "8302-2",
  BUN: "3094-0",
  EGFR: "33914-3",
} as const;

// ---------------------------------------------------------------------------
// Authenticated FHIR Fetch
// ---------------------------------------------------------------------------

async function fhirFetch(
  fhirServerUrl: string,
  path: string,
  accessToken: string,
): Promise<unknown> {
  const url = `${fhirServerUrl.replace(/\/$/, "")}/${path}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/fhir+json",
    },
  });
  if (!res.ok) {
    throw new Error(`FHIR ${res.status}: ${res.statusText} — ${path}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Patient Data Fetchers
// ---------------------------------------------------------------------------

/**
 * Fetch patient demographics from FHIR Patient resource.
 */
export async function fetchPatient(ctx: SmartContext): Promise<FhirPatientData> {
  const patient = (await fhirFetch(ctx.fhirServerUrl, `Patient/${ctx.patientId}`, ctx.accessToken)) as Record<string, unknown>;

  let age: number | undefined;
  const birthDate = patient.birthDate as string | undefined;
  if (birthDate) {
    const birth = new Date(birthDate);
    const now = new Date();
    age = Math.floor((now.getTime() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  }

  // Extract name
  const nameArr = patient.name as Array<{ given?: string[]; family?: string }> | undefined;
  const nameObj = nameArr?.[0];
  const name = nameObj ? `${(nameObj.given ?? []).join(" ")} ${nameObj.family ?? ""}`.trim() : undefined;

  return {
    name,
    birthDate,
    age,
    gender: patient.gender as string | undefined,
  };
}

/**
 * Fetch the most recent body weight from Observations.
 */
export async function fetchWeight(ctx: SmartContext): Promise<number | null> {
  const bundle = (await fhirFetch(
    ctx.fhirServerUrl,
    `Observation?patient=${ctx.patientId}&code=${LOINC.BODY_WEIGHT}&_sort=-date&_count=1`,
    ctx.accessToken,
  )) as { entry?: Array<{ resource: Record<string, unknown> }> };

  const entry = bundle.entry?.[0]?.resource;
  if (!entry) return null;

  const valueQuantity = entry.valueQuantity as { value?: number; unit?: string } | undefined;
  if (!valueQuantity?.value) return null;

  // Convert to kg if needed
  const val = valueQuantity.value;
  const unit = (valueQuantity.unit ?? "kg").toLowerCase();
  if (unit.includes("lb") || unit.includes("pound")) return Math.round(val * 0.453592 * 10) / 10;
  return Math.round(val * 10) / 10;
}

/**
 * Fetch the most recent serum creatinine.
 */
export async function fetchSerumCreatinine(ctx: SmartContext): Promise<FhirLabResult | null> {
  const bundle = (await fhirFetch(
    ctx.fhirServerUrl,
    `Observation?patient=${ctx.patientId}&code=${LOINC.SERUM_CREATININE}&_sort=-date&_count=1`,
    ctx.accessToken,
  )) as { entry?: Array<{ resource: Record<string, unknown> }> };

  const entry = bundle.entry?.[0]?.resource;
  if (!entry) return null;

  const vq = entry.valueQuantity as { value?: number; unit?: string } | undefined;
  if (!vq?.value) return null;

  return {
    code: LOINC.SERUM_CREATININE,
    display: "Serum Creatinine",
    value: vq.value,
    unit: vq.unit ?? "mg/dL",
    date: (entry.effectiveDateTime as string) ?? "",
  };
}

/**
 * Fetch vancomycin drug levels (last 5).
 */
export async function fetchVancomycinLevels(ctx: SmartContext): Promise<FhirLabResult[]> {
  const codes = [LOINC.VANCOMYCIN_LEVEL, LOINC.VANCOMYCIN_TROUGH, LOINC.VANCOMYCIN_PEAK].join(",");
  const bundle = (await fhirFetch(
    ctx.fhirServerUrl,
    `Observation?patient=${ctx.patientId}&code=${codes}&_sort=-date&_count=5`,
    ctx.accessToken,
  )) as { entry?: Array<{ resource: Record<string, unknown> }> };

  if (!bundle.entry) return [];

  return bundle.entry.map(e => {
    const r = e.resource;
    const vq = r.valueQuantity as { value?: number; unit?: string } | undefined;
    const coding = ((r.code as { coding?: Array<{ code?: string; display?: string }> })?.coding ?? [])[0];
    return {
      code: coding?.code ?? "",
      display: coding?.display ?? "Vancomycin Level",
      value: vq?.value ?? 0,
      unit: vq?.unit ?? "mcg/mL",
      date: (r.effectiveDateTime as string) ?? "",
    };
  }).filter(l => l.value > 0);
}

/**
 * Fetch active vancomycin medication orders.
 */
export async function fetchVancomycinOrders(ctx: SmartContext): Promise<FhirMedicationOrder[]> {
  // Search by RxNorm code for vancomycin (11124)
  const bundle = (await fhirFetch(
    ctx.fhirServerUrl,
    `MedicationRequest?patient=${ctx.patientId}&code=11124&status=active,completed&_sort=-date&_count=5`,
    ctx.accessToken,
  )) as { entry?: Array<{ resource: Record<string, unknown> }> };

  if (!bundle.entry) return [];

  return bundle.entry.map(e => {
    const r = e.resource;
    const dosage = (r.dosageInstruction as Array<Record<string, unknown>> | undefined)?.[0];
    const doseQuantity = dosage?.doseAndRate as Array<{ doseQuantity?: { value?: number; unit?: string } }> | undefined;
    const dose_mg = doseQuantity?.[0]?.doseQuantity?.value;

    // Extract timing/frequency
    const timing = dosage?.timing as { repeat?: { frequency?: number; period?: number; periodUnit?: string } } | undefined;
    let interval_hours: number | undefined;
    if (timing?.repeat?.period && timing.repeat.periodUnit === "h") {
      interval_hours = timing.repeat.period;
    }

    return {
      drug: "Vancomycin",
      dose_mg,
      interval_hours,
      route: (dosage?.route as { text?: string })?.text,
      status: (r.status as string) ?? "unknown",
      authored: (r.authoredOn as string) ?? "",
    };
  });
}

// ---------------------------------------------------------------------------
// Aggregate: Pull all vancomycin-relevant data for the calculator
// ---------------------------------------------------------------------------

export interface VancomycinFhirData {
  patient: FhirPatientData;
  weight_kg: number | null;
  serum_creatinine: FhirLabResult | null;
  vancomycin_levels: FhirLabResult[];
  medication_orders: FhirMedicationOrder[];
}

export async function fetchAllVancomycinData(ctx: SmartContext): Promise<VancomycinFhirData> {
  const [patient, weight_kg, serum_creatinine, vancomycin_levels, medication_orders] = await Promise.all([
    fetchPatient(ctx),
    fetchWeight(ctx),
    fetchSerumCreatinine(ctx),
    fetchVancomycinLevels(ctx),
    fetchVancomycinOrders(ctx),
  ]);

  return { patient, weight_kg, serum_creatinine, vancomycin_levels, medication_orders };
}
