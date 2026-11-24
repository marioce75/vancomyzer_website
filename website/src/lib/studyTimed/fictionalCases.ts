/**
 * FICTIONAL cases for development, testing, the offline package examples and
 * the owner-only demo. Invented by the developer; they describe no real person
 * and come from no patient record. Prediction inputs only: the separate
 * fictional "lab results" used by the demo's reveal step live in
 * studyDemo/fictionalOutcomes.ts and never enter a prediction.
 */
import type { TimedCaseInput } from "./predictAtDraw";

export interface FictionalCase {
  input: TimedCaseInput;
  title: string;
  /** Plain-language timeline for the demo. */
  story: string;
}

export const FICTIONAL_CASES: FictionalCase[] = [
  {
    title: "Single dose, sample before dose 2",
    story: "One 1,500 mg dose over 90 min. Sample drawn 30 min before the second dose, which is listed but excluded because it started after the draw.",
    input: {
      study_case_id: "FICT-A01",
      time_basis: "elapsed_hours",
      age_years: 58,
      weight_kg: 84,
      serum_creatinine_mg_dl: 0.9,
      scr_collected_at: -3,
      renal_replacement_therapy: false,
      history_complete_attested: true,
      draw_time: 11.5,
      doses: [
        { start: 0, dose_mg: 1500, infusion_minutes: 90 },
        { start: 12, dose_mg: 1250, infusion_minutes: 90 },
      ],
    },
  },
  {
    title: "Loading dose then maintenance",
    story: "2,000 mg loading dose over 120 min, then 1,000 mg over 60 min every 12 h starting 12 h later. Sample drawn 30 min before the fourth maintenance dose.",
    input: {
      study_case_id: "FICT-A02",
      time_basis: "elapsed_hours",
      age_years: 71,
      weight_kg: 77,
      serum_creatinine_mg_dl: 1.2,
      scr_collected_at: -6,
      renal_replacement_therapy: false,
      history_complete_attested: true,
      draw_time: 47.5,
      doses: [
        { start: 0, dose_mg: 2000, infusion_minutes: 120 },
        { start: 12, dose_mg: 1000, infusion_minutes: 60 },
        { start: 24, dose_mg: 1000, infusion_minutes: 60 },
        { start: 36, dose_mg: 1000, infusion_minutes: 60 },
      ],
    },
  },
  {
    title: "Delayed and held doses",
    story: "1,250 mg every 12 h was planned. Dose 3 was given 4 h late and the next planned dose was held. Only the doses actually given are used.",
    input: {
      study_case_id: "FICT-A03",
      time_basis: "elapsed_hours",
      age_years: 46,
      weight_kg: 102,
      serum_creatinine_mg_dl: 1.0,
      scr_collected_at: -1.5,
      renal_replacement_therapy: false,
      history_complete_attested: true,
      draw_time: 39,
      doses: [
        { start: 0, dose_mg: 1250, infusion_minutes: 90 },
        { start: 12, dose_mg: 1250, infusion_minutes: 90 },
        { start: 28, dose_mg: 1250, infusion_minutes: 90 },
      ],
    },
  },
  {
    title: "Infusion running at the draw",
    story: "Two 1,000 mg doses over 60 min, 8 h apart, then a third started 30 min before the sample. Only the half of dose 3 infused before the draw counts.",
    input: {
      study_case_id: "FICT-A04",
      time_basis: "elapsed_hours",
      age_years: 33,
      weight_kg: 68,
      serum_creatinine_mg_dl: 0.7,
      scr_collected_at: -2,
      renal_replacement_therapy: false,
      history_complete_attested: true,
      draw_time: 16.5,
      doses: [
        { start: 0, dose_mg: 1000, infusion_minutes: 60 },
        { start: 8, dose_mg: 1000, infusion_minutes: 60 },
        { start: 16, dose_mg: 1000, infusion_minutes: 60 },
      ],
    },
  },
  {
    title: "Clock times across a time-zone offset change",
    story: "Clock times with explicit offsets that change from -05:00 to -06:00 overnight (a daylight-saving change in a fictional year). Elapsed time is computed from the offsets, not the wall clock.",
    input: {
      study_case_id: "FICT-A05",
      time_basis: "datetime",
      age_years: 64,
      weight_kg: 91,
      serum_creatinine_mg_dl: 1.4,
      scr_collected_at: "2030-11-02T18:10-05:00",
      renal_replacement_therapy: false,
      history_complete_attested: true,
      draw_time: "2030-11-03T19:30-06:00",
      doses: [
        { start: "2030-11-02T20:00-05:00", dose_mg: 1750, end: "2030-11-02T22:00-05:00" },
        { start: "2030-11-03T08:00-06:00", dose_mg: 1250, infusion_minutes: 90 },
      ],
    },
  },
];

/** Fictional inputs that must be refused (used in the examples and tests). */
export const FICTIONAL_REFUSED_CASES: TimedCaseInput[] = [
  {
    study_case_id: "FICT-R01",
    time_basis: "elapsed_hours",
    age_years: 52,
    weight_kg: 80,
    serum_creatinine_mg_dl: 1.0,
    scr_collected_at: -1,
    renal_replacement_therapy: false,
    history_complete_attested: true,
    draw_time: 11,
    doses: [
      { start: 0, dose_mg: 1000, infusion_minutes: 60 },
      { start: 0.5, dose_mg: 1000, infusion_minutes: 60 },
    ],
  },
  {
    study_case_id: "FICT-R02",
    time_basis: "elapsed_hours",
    age_years: 60,
    weight_kg: 75,
    serum_creatinine_mg_dl: 4.2,
    scr_collected_at: -1,
    renal_replacement_therapy: true,
    history_complete_attested: true,
    draw_time: 20,
    doses: [{ start: 0, dose_mg: 1500, infusion_minutes: 90 }],
  },
];
