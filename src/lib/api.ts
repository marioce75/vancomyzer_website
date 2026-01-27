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

const API_BASE = 
  (document.querySelector('meta[name="vancomyzer-api-base"]') as HTMLMetaElement)?.content || "";

async function postJSON<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return res.json();
}

export async function calculatePk(payload: PkCalculatePayload): Promise<PkCalculateResponse> {
  return postJSON<PkCalculateResponse>(`${API_BASE}/api/pk/calculate`, payload);
}

export async function bayesianEstimate(payload: PkCalculatePayload): Promise<PkCalculateResponse> {
  return postJSON<PkCalculateResponse>(`${API_BASE}/api/pk/bayesian`, payload);
}
