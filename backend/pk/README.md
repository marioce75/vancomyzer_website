PK helper functions

- cockcroft_gault(age, weight_kg, scr_mgdl, sex) -> mL/min
- infusion_conc_single(t, dose_mg, tinf_h, cl_L_h, v_L) -> mg/L
- superposition_conc(times, dose_mg, tau_h, tinf_h, cl_L_h, v_L, horizon_h=48) -> conc array
- trapezoid(x,y,a,b) for AUC0-24
- peak_trough(times, conc, tau_h) -> (peak, trough)
