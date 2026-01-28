// Lightweight API client for FastAPI backend
export type PkCalculatePayload = {
  age: number;
  sex: "male" | "female";
  heightCm: number;
  weightKg: number;
  scrMgDl: number;
  icu: boolean;
  infectionSeverity: "standard" | "serious";
  mic: number; // default 1.0
  aucTargetLow?: number; // default 400
  aucTargetHigh?: number; // default 600
  levels?: Array<{ timeHr: number; concentration: number }>;
  doseHistory?: Array<{ timeHr: number; doseMg: number }>;
};

export type PkCalculateResponse = {
  loadingDoseMg?: number;
  maintenanceDoseMg: number;
  intervalHr: number;
  auc24: number;
  troughPredicted?: { low: number; high: number };
  safety: {
    aucWarning600?: boolean;
    aucWarning800?: boolean;
    crclLow?: boolean;
    messages: string[];
  };
  concentrationCurve?: Array<{ t: number; c: number }>;
};

export type ReferenceEntry = { title: string; org: string; year: number; note?: string };
export type ReferencesResponse = { references: ReferenceEntry[] };
export type DisclaimerResponse = { short: string; full: string[] };

const API_BASE = ""; // same origin

type ApiErrorBody = { detail?: string };

async function readErrorDetail(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as ApiErrorBody;
    if (body?.detail) return body.detail;
  } catch {
    // ignore
  }
  try {
    const text = await res.text();
    if (text) return text;
  } catch {
    // ignore
  }
  return `Service error: ${res.status}`;
}

async function postJSON<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(await readErrorDetail(res));
  }
  return res.json();
}

export async function calculatePk(payload: PkCalculatePayload): Promise<PkCalculateResponse> {
  return postJSON<PkCalculateResponse>(`${API_BASE}/api/pk/calculate`, payload);
}

export async function bayesianEstimate(payload: PkCalculatePayload): Promise<PkCalculateResponse> {
  return postJSON<PkCalculateResponse>(`${API_BASE}/api/pk/bayesian`, payload);
}

export async function getReferences(): Promise<ReferencesResponse> {
  const res = await fetch(`${API_BASE}/api/meta/references`);
  if (!res.ok) throw new Error(await readErrorDetail(res));
  return res.json();
}

export async function getDisclaimer(): Promise<DisclaimerResponse> {
  const res = await fetch(`${API_BASE}/api/meta/disclaimer`);
  if (!res.ok) throw new Error(await readErrorDetail(res));
  return res.json();
}
