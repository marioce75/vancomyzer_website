/** Operational calculation telemetry. Never persist clinical values or account identity here.
 * Historical host logs are separate records and require a retention review.
 */
import { MODEL_MANIFEST_VERSION } from "./pk/modelRegistry";

export interface AuditEntry {
  id: string;
  timestamp: string;
  mode: "initial_regimen" | "existing_regimen";
  duration_ms: number;
  status: "success" | "error" | "validation_error";

  // De-identified inputs
  model_manifest?: string;
  inputs?: {
    age: number;
    weight_kg: number;
    serum_creatinine_mg_dl: number;
    dose_mg?: number;
    interval_hours?: number;
    infusion_duration_hours?: number;
    doses_given?: number;
    level_count: number;
  };

  // Outputs (only on success)
  outputs?: {
    auc24: number;
    peak: number;
    trough: number;
    recommended_dose: string;
    recommended_interval_hours: number;
    frequency_options_count: number;
    used_posterior_refinement: boolean;
    evidence_strength?: string;
  };

  // PK parameters (only on success)
  pk_parameters?: {
    CL: number;
    V1: number;
    Q: number;
    V2: number;
  };

  // User attribution
  user_email?: string;

  // Error info (only on error)
  error?: {
    type: string;
    message: string;
    field_errors?: Record<string, string>;
  };
}

// ---------------------------------------------------------------------------
// In-memory ring buffer — last 500 calculations
// ---------------------------------------------------------------------------

const MAX_ENTRIES = 500;
const auditBuffer: AuditEntry[] = [];

function generateId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 8);
  return `vc-${ts}-${rand}`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function logCalculation(entry: Omit<AuditEntry, "id" | "timestamp">): AuditEntry {
  // Explicit allowlist: future additions to the caller cannot leak into logs.
  const full: AuditEntry = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    mode: entry.mode,
    duration_ms: entry.duration_ms,
    status: entry.status,
    model_manifest: MODEL_MANIFEST_VERSION,
  };

  // Write to console as structured JSON
  console.log(`[VANCOMYZER AUDIT] ${JSON.stringify(full)}`);

  // Add to ring buffer
  auditBuffer.push(full);
  if (auditBuffer.length > MAX_ENTRIES) {
    auditBuffer.shift();
  }

  return full;
}

export function getAuditLog(): AuditEntry[] {
  return [...auditBuffer];
}

export function getAuditSummary(): {
  total_calculations: number;
  successful: number;
  errors: number;
  validation_errors: number;
  avg_duration_ms: number;
  last_calculation?: string;
  modes: Record<string, number>;
} {
  const total = auditBuffer.length;
  const successful = auditBuffer.filter(e => e.status === "success").length;
  const errors = auditBuffer.filter(e => e.status === "error").length;
  const validation_errors = auditBuffer.filter(e => e.status === "validation_error").length;
  const durations = auditBuffer.map(e => e.duration_ms);
  const avg_duration_ms = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;
  const last = auditBuffer[auditBuffer.length - 1];

  const modes: Record<string, number> = {};
  for (const e of auditBuffer) {
    modes[e.mode] = (modes[e.mode] ?? 0) + 1;
  }

  return {
    total_calculations: total,
    successful,
    errors,
    validation_errors,
    avg_duration_ms,
    last_calculation: last?.timestamp,
    modes,
  };
}
