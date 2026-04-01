/**
 * Institutional settings — clinical defaults that a pharmacy department configures.
 *
 * These are separate from visual/theme settings (MatrixSettings).
 * They control clinical behavior: AUC targets, infusion policies, model preferences.
 *
 * Storage: per-user in data/users.json (settings field) with institutional defaults
 * that can be shared across users from the same institution.
 */

import fs from "fs";
import path from "path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InstitutionalSettings {
  // AUC targets
  auc24_target_low: number;          // Default: 400 mg·h/L (ASHP/IDSA 2020)
  auc24_target_high: number;         // Default: 600 mg·h/L
  auc24_target_mid: number;          // Default: 500 mg·h/L

  // Trough targets (reference display)
  trough_target_low: number;         // Default: 10 mcg/mL
  trough_target_high: number;        // Default: 20 mcg/mL

  // Infusion policy
  max_infusion_rate_mg_per_min: number;  // Default: 10 mg/min (FDA)
  min_infusion_duration_hours: number;   // Default: 1 hour (60 min)

  // Loading dose policy
  loading_dose_mg_per_kg: number;    // Default: 25 mg/kg
  loading_dose_max_mg: number;       // Default: 3000 mg
  loading_dose_enabled: boolean;     // Default: true

  // Dose range limits
  max_single_dose_mg: number;        // Default: 2000 mg
  max_daily_dose_mg: number;         // Default: 4500 mg

  // Model preferences
  default_pk_model: string;          // Default: "colin_2019"

  // Level timing
  min_post_infusion_hours: number;   // Default: 0.5 hours
  pulse_dose_min_post_infusion_hours: number;  // Default: 2.0 hours

  // Display preferences
  show_math_by_default: boolean;     // Default: true
  default_graph_zoom_hours: number;  // Default: 96

  // Institutional identity
  institution_name: string;          // Default: ""
  institution_protocol_url: string;  // Default: "" — link to local vancomycin protocol
}

export const DEFAULT_INSTITUTIONAL_SETTINGS: InstitutionalSettings = {
  auc24_target_low: 400,
  auc24_target_high: 600,
  auc24_target_mid: 500,
  trough_target_low: 10,
  trough_target_high: 20,
  max_infusion_rate_mg_per_min: 10,
  min_infusion_duration_hours: 1,
  loading_dose_mg_per_kg: 25,
  loading_dose_max_mg: 3000,
  loading_dose_enabled: true,
  max_single_dose_mg: 2000,
  max_daily_dose_mg: 4500,
  default_pk_model: "colin_2019",
  min_post_infusion_hours: 0.5,
  pulse_dose_min_post_infusion_hours: 2.0,
  show_math_by_default: true,
  default_graph_zoom_hours: 96,
  institution_name: "",
  institution_protocol_url: "",
};

// ---------------------------------------------------------------------------
// Storage — institutional defaults per institution name
// ---------------------------------------------------------------------------

const DATA_DIR = path.join(process.cwd(), "data");
const SETTINGS_FILE = path.join(DATA_DIR, "institutional_settings.json");

function ensureFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(SETTINGS_FILE)) fs.writeFileSync(SETTINGS_FILE, "{}", "utf-8");
}

type SettingsMap = Record<string, Partial<InstitutionalSettings>>;

function readAll(): SettingsMap {
  ensureFile();
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf-8")) as SettingsMap;
  } catch { return {}; }
}

function writeAll(data: SettingsMap) {
  ensureFile();
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2), "utf-8");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get settings for an institution, merged with defaults.
 */
export function getInstitutionalSettings(institutionName: string): InstitutionalSettings {
  const all = readAll();
  const overrides = all[institutionName.toLowerCase().trim()] ?? {};
  return { ...DEFAULT_INSTITUTIONAL_SETTINGS, ...overrides };
}

/**
 * Save institutional settings (partial update).
 */
export function saveInstitutionalSettings(institutionName: string, settings: Partial<InstitutionalSettings>) {
  const all = readAll();
  const key = institutionName.toLowerCase().trim();
  all[key] = { ...(all[key] ?? {}), ...settings };
  writeAll(all);
}

/**
 * Get settings for a specific user — resolves institution name from user record,
 * then merges institutional defaults with any user-level overrides.
 */
export function getSettingsForUser(institution: string): InstitutionalSettings {
  if (!institution || institution.trim() === "") {
    return { ...DEFAULT_INSTITUTIONAL_SETTINGS };
  }
  return getInstitutionalSettings(institution);
}
