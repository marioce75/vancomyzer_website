export type Sex = 'Male' | 'Female';

export interface Patient {
  ageY: number;
  sex: Sex;
  weightKg: number;
  heightCm?: number;
  scrMgDl: number;
  mic?: number;
}

export interface Regimen {
  doseMg: number;
  intervalH: number;
  infusionMin: number;
}

export interface Level {
  time_hours: number;
  concentration_mg_L: number;
  tag?: string;
}

export interface Summary {
  auc_24: number;
  predicted_peak: number;
  predicted_trough: number;
}
