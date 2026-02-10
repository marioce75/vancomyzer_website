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
  return postJSON<PkCalculateResponse>(`${API_BASE}/api/pk/calculate-legacy`, payload);
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

export type CalculateMode = "empiric" | "bayes_demo";

export type CalculateRequest = {
  mode: CalculateMode;
  patient: {
    age_yr: number;
    sex: "male" | "female";
    weight_kg: number;
    serum_creatinine_mg_dl: number;
  };
  regimen: {
    dose_mg: number;
    interval_hr: number;
    infusion_hr: number;
  };
  dose_history?: Array<{ dose_mg: number; start_time_hr: number; infusion_hr: number }>;
  levels?: Array<{ time_hr: number; concentration_mg_l: number }>;
};

export type CalculateResponse = {
  auc24_mg_h_l: number;
  trough_mg_l: number;
  peak_mg_l: number;
  concentration_curve: Array<{ t_hr: number; conc_mg_l: number }>;
  safety: Array<{ kind: "info" | "warning"; message: string }>;
  bayes_demo?: {
    label: string;
    cl_l_hr: number;
    v_l: number;
    ke_hr: number;
    rmse_mg_l: number;
  };
};

export async function calculateEducational(req: CalculateRequest): Promise<CalculateResponse> {
  return postJSON<CalculateResponse>(`${API_BASE}/api/pk/educational`, req);
}

export type BasicCalculateRequest = {
  patient: {
    age: number;
    sex: "male" | "female";
    height_cm: number;
    weight_kg: number;
    serum_creatinine: number;
  };
  regimen: {
    dose_mg: number;
    interval_hr: number;
    infusion_hr?: number;
  };
  mic?: number;
  icu?: boolean;
  mrsa?: boolean;
  crcl_method?: number;
  forced_crcl?: number;
};

export type BasicCalculateResponse = {
  crcl: {
    selected_ml_min?: number;
    selected_l_hr?: number;
    tbw?: number;
    abw?: number;
    ibw?: number;
    tbw_scr1?: number;
    forced?: number;
  };
  regimen: {
    recommended_interval_hr?: number;
    recommended_dose_mg?: number;
    recommended_loading_dose_mg?: number;
    chosen_interval_hr: number;
    chosen_dose_mg: number;
    infusion_hr?: number;
  };
  predicted: {
    auc24?: number;
    peak?: number;
    trough?: number;
    half_life_hr?: number;
  };
  breakdown: Record<string, unknown>;
  curve?: Array<{ t_hr: number; conc_mg_l: number }>;
};

export type DoseRequest = {
  patient: {
    age_years: number;
    weight_kg: number;
    height_cm?: number | null;
    sex: "male" | "female";
    serum_creatinine: number;
    serious_infection?: boolean;
  };
  levels?: Array<{
    level_mg_l: number;
    time_hours: number;
    level_type?: "peak" | "trough" | null;
    dose_mg?: number | null;
    infusion_hours?: number | null;
  }> | null;
};

type DoseResponse = {
  loading_dose_mg: number;
  maintenance_dose_mg: number;
  interval_hours: number;
  infusion_hours: number;
  predicted_peak_mg_l: number;
  predicted_trough_mg_l: number;
  predicted_auc_24: number;
  k_e: number;
  vd_l: number;
  half_life_hours: number;
  crcl_ml_min: number;
  method: string;
  notes: string[];
  concentration_curve: Array<{ t_hr: number; conc_mg_l: number }>;
};

export async function calculateBasic(req: BasicCalculateRequest): Promise<BasicCalculateResponse> {
  const payload: DoseRequest = {
    patient: {
      age_years: req.patient.age,
      weight_kg: req.patient.weight_kg,
      height_cm: req.patient.height_cm,
      sex: req.patient.sex,
      serum_creatinine: req.patient.serum_creatinine,
      serious_infection: false,
    },
    levels: null,
  };
  const res = await postJSON<DoseResponse>(`${API_BASE}/api/calculate-dose`, payload);
  return {
    crcl: {
      selected_ml_min: res.crcl_ml_min,
    },
    regimen: {
      recommended_interval_hr: res.interval_hours,
      recommended_dose_mg: res.maintenance_dose_mg,
      recommended_loading_dose_mg: res.loading_dose_mg,
      chosen_interval_hr: req.regimen.interval_hr,
      chosen_dose_mg: req.regimen.dose_mg,
      infusion_hr: res.infusion_hours ?? req.regimen.infusion_hr,
    },
    predicted: {
      auc24: res.predicted_auc_24,
      peak: res.predicted_peak_mg_l,
      trough: res.predicted_trough_mg_l,
      half_life_hr: res.half_life_hours,
    },
    breakdown: {},
    curve: res.concentration_curve,
  };
}

export type BayesianCalculateResponse = {
  auc24: number;
  auc24_ci_low: number;
  auc24_ci_high: number;
  cl_l_hr: number;
  v_l: number;
  curve: Array<{ t_hr: number; conc_mg_l: number }>;
  curve_ci_low: Array<{ t_hr: number; conc_mg_l: number }>;
  curve_ci_high: Array<{ t_hr: number; conc_mg_l: number }>;
  infusion_hr?: number;
  recommendation: {
    target_auc: number;
    daily_dose_mg: number;
    per_dose_mg: number;
    interval_hr: number;
    max_loading_mg?: number;
    max_daily_mg?: number;
  };
  warnings: string[];
};

export async function calculateBayesian(req: DoseRequest): Promise<BayesianCalculateResponse> {
  const res = await postJSON<DoseResponse>(`${API_BASE}/api/bayesian-dose`, req);
  const cl = res.k_e * res.vd_l;
  return {
    auc24: res.predicted_auc_24,
    auc24_ci_low: res.predicted_auc_24,
    auc24_ci_high: res.predicted_auc_24,
    cl_l_hr: cl,
    v_l: res.vd_l,
    curve: res.concentration_curve,
    curve_ci_low: [],
    curve_ci_high: [],
    infusion_hr: res.infusion_hours,
    recommendation: {
      target_auc: res.predicted_auc_24,
      daily_dose_mg: res.maintenance_dose_mg * (24.0 / res.interval_hours),
      per_dose_mg: res.maintenance_dose_mg,
      interval_hr: res.interval_hours,
    },
    warnings: res.notes || [],
  };
}
