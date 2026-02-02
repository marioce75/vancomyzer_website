// Lightweight API client for FastAPI backend
export type PkCalculatePayload = {
  age: number;
  sex: "male" | "female";
  heightCm: number;
  weightKg: number;
  serumCreatinine: number;
  icu: boolean;
  infectionSeverity: "standard" | "serious";
  mic: number;
  aucTargetLow?: number;
  aucTargetHigh?: number;
  levels?: Array<{ concentration: number; timeHoursFromDoseStart: number }>;
  doseHistory?: Array<{ doseMg: number; startTimeHours: number; infusionHours: number }>;
  regimen?: { doseMg: number; intervalHr: number; infusionHours: number };
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

export type CalculateRequest = PkCalculatePayload;
export type CalculateResponse = PkCalculateResponse;

export type ReferenceEntry = { title: string; org: string; year: number; note?: string };
export type ReferencesResponse = { references: ReferenceEntry[] };
export type DisclaimerResponse = { short: string; full: string[] };
export type VersionResponse = { git: string | null; built_at: string };
export type SupportVersionResponse = {
  app: string;
  version: string;
  git_sha: string | null;
  build_time: string;
  environment: string;
};

const API_BASE = "";

export type ApiValidationError = {
  loc: Array<string | number>;
  msg: string;
  type: string;
};

export class ApiError extends Error {
  status: number;
  detail?: string;
  errors?: ApiValidationError[];
  received_body?: unknown;

  constructor(message: string, status: number, opts?: { detail?: string; errors?: ApiValidationError[]; received_body?: unknown }) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = opts?.detail;
    this.errors = opts?.errors;
    this.received_body = opts?.received_body;
  }
}

async function readErrorBody(
  res: Response,
): Promise<{ detail?: string; errors?: ApiValidationError[]; received_body?: unknown } | null> {
  const clone = res.clone();
  try {
    const body: unknown = await res.json();
    if (body && typeof body === "object") {
      const maybe = body as { detail?: unknown; errors?: unknown; received_body?: unknown };
      return {
        detail: typeof maybe.detail === "string" ? maybe.detail : undefined,
        errors: Array.isArray(maybe.errors) ? (maybe.errors as ApiValidationError[]) : undefined,
        received_body: maybe.received_body,
      };
    }
    if (typeof body === "string") {
      return { detail: body };
    }
  } catch {
    // fall through
  }

  try {
    const text = await clone.text();
    if (text) return { detail: text };
  } catch {
    // ignore
  }

  return null;
}

async function postJSON<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const parsed = await readErrorBody(res);
    const detail = parsed?.detail;
    const errors = parsed?.errors;
    const received_body = parsed?.received_body;
    const message = detail || `Service error: ${res.status}`;
    throw new ApiError(message, res.status, { detail, errors, received_body });
  }

  return res.json();
}

export async function calculatePk(payload: PkCalculatePayload): Promise<PkCalculateResponse> {
  return postJSON<PkCalculateResponse>(`${API_BASE}/api/pk/calculate`, payload);
}

export async function calculateEducational(payload: CalculateRequest): Promise<CalculateResponse> {
  return postJSON<CalculateResponse>(`${API_BASE}/api/pk/calculate`, payload);
}

export async function bayesianEstimate(payload: PkCalculatePayload): Promise<PkCalculateResponse> {
  return postJSON<PkCalculateResponse>(`${API_BASE}/api/pk/bayesian`, payload);
}

export async function getReferences(): Promise<ReferencesResponse> {
  const res = await fetch(`${API_BASE}/api/meta/references`);
  if (!res.ok) {
    const parsed = await readErrorBody(res);
    throw new ApiError(parsed?.detail || `Service error: ${res.status}`, res.status, parsed ?? undefined);
  }
  return res.json();
}

export async function getDisclaimer(): Promise<DisclaimerResponse> {
  const res = await fetch(`${API_BASE}/api/meta/disclaimer`);
  if (!res.ok) {
    const parsed = await readErrorBody(res);
    throw new ApiError(parsed?.detail || `Service error: ${res.status}`, res.status, parsed ?? undefined);
  }
  return res.json();
}

export async function getVersion(): Promise<VersionResponse> {
  const res = await fetch(`${API_BASE}/api/meta/version`);
  if (!res.ok) {
    const parsed = await readErrorBody(res);
    throw new ApiError(parsed?.detail || `Service error: ${res.status}`, res.status, parsed ?? undefined);
  }
  return res.json();
}

export async function getSupportVersion(): Promise<SupportVersionResponse> {
  const res = await fetch(`${API_BASE}/api/version`);
  if (!res.ok) {
    const parsed = await readErrorBody(res);
    throw new ApiError(parsed?.detail || `Service error: ${res.status}`, res.status, parsed ?? undefined);
  }
  return res.json();
}
