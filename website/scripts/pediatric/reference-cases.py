#!/usr/bin/env python3
"""Independent reference implementation for the Colin 2019 pediatric engine.

Standard library only; shares NO code with src/lib/pediatric. Everything is
derived from the official supplementary NONMEM control stream (MOESM2, final
iteration estimates) and, for the sensitivity variant, article Table 3 / Eq. 5-13.

Produces docs/pediatric/reference-cases.json, which
src/lib/pediatric/__tests__/reference.test.ts replays against the TypeScript
engine:
  A. typical parameters for both formulations (incl. the article's own worked
     examples, which reproduce only under the article transcription);
  B. concentrations and cumulative AUC from a 4th-order Runge-Kutta ODE solver
     on explicit infusion schedules (independent of the analytic solution);
  C. MAP objective values at fixed eta and the MAP optimum from an independent
     Nelder-Mead, for one- and two-level cases;
  D. age-convention and dataset-boundary cases: the model PMA for neonatal and
     non-neonatal inputs under the preview's convention (PNA/365.25 + GA/52),
     the deviation of the author variants (GA+PNA/7 weeks then /52; the control
     stream identity (GA*7+PNA)/365), the clearance sensitivity to one day of
     PMA, and the expected accept/refuse outcome at the dataset boundaries
     (PMA floor 0.45 y; gap 0.88-2.58 y; 18 years).

Run from website/:  python3 scripts/pediatric/reference-cases.py
Synthetic covariates only; no patient data; no network access.
"""
import json
import math
import os

# --- Final-iteration estimates, MOESM2 (iteration 29, NPARAMETR) -------------
TH = dict(lnCL=1.6674, lnV1=3.7555, lnV2=3.7343, lnQ=1.1665, lnDEG50=4.1159,
          lnMAT50=-0.11302, lnGAM=1.0611, lnGAM2=0.80677, lnEXPO2=-0.43280,
          heelV1=0.31217, heelQ=0.59679, cancerCL=0.29422)
OMEGA = dict(CL=0.074619, V1=0.071637, V2=0.68444)
SIGMA = dict(prop=0.045986, add=1.5166)
PMA_R = 35 + 40 / 52
DAYS_PER_YEAR = 365.25

def pma_preview(ga_wk, pna_days):
    """Preview convention: chronological postnatal years + gestational weeks / 52."""
    return pna_days / DAYS_PER_YEAR + ga_wk / 52

def pma_clinical_weeks(ga_wk, pna_days):
    return ga_wk + pna_days / 7

def pma_control_stream(ga_wk, pna_days):
    """Identity in the supplementary control stream: GA = (PMA*365 - PNA)/7."""
    return (ga_wk * 7 + pna_days) / 365

GAP_FROM, GAP_TO, PMA_FLOOR_Y, ADULT_Y = 0.88, 2.58, 23.4 / 52, 18.0

def scrstd(pma, article=False):
    if article:
        return math.exp(-1.228 + 0.672 * math.log10(pma) + 6.27 * math.exp(-3.11 * pma))
    return math.exp(-1.22839 + 0.67190 * math.log10(pma) + 6.27017 * math.exp(-3.10940 * pma))

def params(pma, wgt, scr, eta=(0.0, 0.0, 0.0), article=False, heel=0, cancer=0):
    """Returns (CL, V1, Q, V2) exactly as $PK computes them, or per article Eq. 6-13."""
    e1, e2, e3 = eta
    fsize = wgt / 70
    if article:
        wk = pma * 52
        fmat = wk ** 2.89 / (wk ** 2.89 + 46.4 ** 2.89)
        fage = 1 / (1 + (pma / 61.6) ** 2.24)
        fscr = math.exp(-0.649 * (scr - scrstd(pma, True)))
        V1 = 42.9 * fsize * (1 - heel * 0.312) * math.exp(e2)
        V2 = 41.7 * fsize * math.exp(e3)
        CL = 5.31 * (V1 / 42.9) ** 0.75 * fmat * fage * fscr * (1 + cancer * 0.294) * math.exp(e1)
        Q = 3.22 * (V2 / 41.7) ** 0.75 * (1 - heel * 0.597)
        return CL, V1, Q, V2
    DEG50, MAT50, GAM = math.exp(TH['lnDEG50']), math.exp(TH['lnMAT50']), math.exp(TH['lnGAM'])
    EXPO2, GAM2 = math.exp(TH['lnEXPO2']), -math.exp(TH['lnGAM2'])
    fmat = pma ** GAM / (pma ** GAM + MAT50 ** GAM)
    fmat_r = PMA_R ** GAM / (PMA_R ** GAM + MAT50 ** GAM)
    fage = pma ** GAM2 / (pma ** GAM2 + DEG50 ** GAM2)
    fage_r = PMA_R ** GAM2 / (PMA_R ** GAM2 + DEG50 ** GAM2)
    fscr = math.exp(-EXPO2 * (scr - scrstd(pma)))
    TVV1 = math.exp(TH['lnV1']) * fsize * (1 - heel * TH['heelV1'])
    V1 = TVV1 * math.exp(e2)
    TVV2 = math.exp(TH['lnV2']) * fsize
    V2 = TVV2 * math.exp(e3)
    RV1 = math.exp(TH['lnV1'])
    TVCL = math.exp(TH['lnCL']) * (V1 / RV1) ** 0.75 * fmat / fmat_r * fage / fage_r * fscr * (1 + cancer * TH['cancerCL'])
    CL = TVCL * math.exp(e1)
    RV2 = math.exp(TH['lnV2'])
    Q = math.exp(TH['lnQ']) * (V2 / RV2) ** 0.75 * (1 - heel * TH['heelQ'])
    return CL, V1, Q, V2

# --- RK4 two-compartment ODE (amounts), infusion schedule ----------------------
def rk4_profile(p, schedule, times, dt=0.002):
    """schedule: list of (start_h, dose_mg, dur_h). Returns dict time->(conc, cumAUC)."""
    CL, V1, Q, V2 = p
    k10, k12, k21 = CL / V1, Q / V1, Q / V2
    def rate(t):
        r = 0.0
        for s, d, dur in schedule:
            if s <= t < s + dur:
                r += d / dur
        return r
    def deriv(t, y, r):
        a1, a2, auc = y
        return (r - (k10 + k12) * a1 + k21 * a2, k12 * a1 - k21 * a2, a1 / V1)
    # Break points so no RK4 step straddles an infusion edge.
    edges = sorted(set([0.0] + [s for s, _, _ in schedule] + [s + dur for s, _, dur in schedule] + list(times)))
    y = (0.0, 0.0, 0.0)
    t = 0.0
    out = {}
    want = sorted(times)
    wi = 0
    for edge in edges[1:]:
        while t < edge - 1e-12:
            h = min(dt, edge - t)
            # Infusion edges are break points, so the rate is constant within a step:
            # evaluate it once at the step midpoint (an endpoint would straddle an edge).
            r = rate(t + h / 2)
            k1 = deriv(t, y, r)
            k2 = deriv(t + h / 2, tuple(y[i] + h / 2 * k1[i] for i in range(3)), r)
            k3 = deriv(t + h / 2, tuple(y[i] + h / 2 * k2[i] for i in range(3)), r)
            k4 = deriv(t + h, tuple(y[i] + h * k3[i] for i in range(3)), r)
            y = tuple(y[i] + h / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]) for i in range(3))
            t += h
        while wi < len(want) and abs(want[wi] - t) < 1e-9:
            out[want[wi]] = (y[0] / V1, y[2])
            wi += 1
    return out

def objective(eta, pma, wgt, scr, schedule, obs, dt=0.01):
    p = params(pma, wgt, scr, eta)
    prof = rk4_profile(p, schedule, [t for t, _ in obs], dt=dt)
    nll = 0.0
    for t, y in obs:
        f = prof[t][0]
        var = SIGMA['prop'] * f * f + SIGMA['add']
        nll += 0.5 * math.log(2 * math.pi * var) + 0.5 * (y - f) ** 2 / var
    pen = eta[0] ** 2 / (2 * OMEGA['CL']) + eta[1] ** 2 / (2 * OMEGA['V1']) + eta[2] ** 2 / (2 * OMEGA['V2'])
    return nll + pen

def nelder_mead(f, x0, step=0.3, tol=1e-9, max_iter=600):
    n = len(x0)
    simplex = [list(x0)] + [[x0[j] + (step if j == i else 0) for j in range(n)] for i in range(n)]
    scores = [f(v) for v in simplex]
    for _ in range(max_iter):
        order = sorted(range(n + 1), key=lambda i: scores[i])
        simplex = [simplex[i] for i in order]; scores = [scores[i] for i in order]
        if scores[-1] - scores[0] < tol and max(abs(simplex[i][j] - simplex[0][j]) for i in range(1, n + 1) for j in range(n)) < 1e-6:
            break
        c = [sum(simplex[i][j] for i in range(n)) / n for j in range(n)]
        xr = [c[j] + (c[j] - simplex[-1][j]) for j in range(n)]; fr = f(xr)
        if fr < scores[0]:
            xe = [c[j] + 2 * (xr[j] - c[j]) for j in range(n)]; fe = f(xe)
            simplex[-1], scores[-1] = (xe, fe) if fe < fr else (xr, fr); continue
        if fr < scores[-2]:
            simplex[-1], scores[-1] = xr, fr; continue
        if fr < scores[-1]:
            xc = [c[j] + 0.5 * (xr[j] - c[j]) for j in range(n)]; fc = f(xc)
            if fc < fr: simplex[-1], scores[-1] = xc, fc; continue
        else:
            xc = [c[j] + 0.5 * (simplex[-1][j] - c[j]) for j in range(n)]; fc = f(xc)
            if fc < scores[-1]: simplex[-1], scores[-1] = xc, fc; continue
        for i in range(1, n + 1):
            simplex[i] = [simplex[0][j] + 0.5 * (simplex[i][j] - simplex[0][j]) for j in range(n)]
            scores[i] = f(simplex[i])
    best = min(range(n + 1), key=lambda i: scores[i])
    return simplex[best], scores[best]

def main():
    here = os.path.dirname(os.path.abspath(__file__))
    out_path = os.path.join(here, '..', '..', 'docs', 'pediatric', 'reference-cases.json')
    cases = {}
    # A. typical parameters
    typical = []
    for label, pma, wgt, scr, published in [
        ("reference 35 y 70 kg SCr 0.83 (abstract: 4.10 L/h)", PMA_R, 70, 0.83, 4.10),
        ("article example: 60 y 65 kg SCr 0.97 (2.55 L/h)", 60 + 40 / 52, 65, 0.97, 2.55),
        ("article example: 32 wk PMA neonate 1.5 kg SCr 0.64 (0.0756 L/h)", 32 / 52, 1.5, 0.64, 0.0756),
        ("preterm 26 wk GA + 14 d, 0.9 kg, SCr 0.9", (26 + 2) / 52, 0.9, 0.9, None),
        ("term neonate 40 wk + 7 d, 3.4 kg, SCr 0.5", (40 + 1) / 52, 3.4, 0.5, None),
        ("infant 38 wk GA + 90 d, 5.5 kg, SCr 0.3", (38 + 90 / 7) / 52, 5.5, 0.3, None),
        ("toddler 2.0 y postnatal (GA 40), 12 kg, SCr 0.35", 2.0 + 40 / 52, 12, 0.35, None),
        ("child 6 y, 20 kg, SCr 0.4", 6 + 40 / 52, 20, 0.4, None),
        ("child 10 y, 32 kg, SCr 0.6", 10 + 40 / 52, 32, 0.6, None),
        ("adolescent 15 y, 55 kg, SCr 0.8", 15 + 40 / 52, 55, 0.8, None),
        ("adolescent 17.9 y, 90 kg, SCr 1.4 (reduced renal function)", 17.9 + 40 / 52, 90, 1.4, None),
        ("child 4 y, 16 kg, SCr 3.0 (severe renal impairment)", 4 + 40 / 52, 16, 3.0, None),
        ("child 8 y, 25 kg, SCr 0.15 (lowest dataset creatinine)", 8 + 40 / 52, 25, 0.15, None),
    ]:
        f = params(pma, wgt, scr)
        a = params(pma, wgt, scr, article=True)
        typical.append(dict(label=label, pma_years=pma, weight_kg=wgt, scr_mg_dl=scr, published_article_value=published,
                            fitted=dict(CL=f[0], V1=f[1], Q=f[2], V2=f[3]),
                            article=dict(CL=a[0], V1=a[1], Q=a[2], V2=a[3]),
                            scr_std_fitted=scrstd(pma), scr_std_article=scrstd(pma, True)))
    # Study-effect and eta coupling checks
    f = params(34 / 52, 2.0, 0.7, eta=(0.2, -0.3, 0.5), heel=1, cancer=0)
    g = params(12 + 40 / 52, 40, 0.5, eta=(-0.4, 0.25, -0.1), heel=0, cancer=1)
    cases['typical'] = typical
    cases['eta_and_study_effects'] = [
        dict(pma_years=34 / 52, weight_kg=2.0, scr_mg_dl=0.7, eta=[0.2, -0.3, 0.5], heel=True, cancer=False, fitted=dict(CL=f[0], V1=f[1], Q=f[2], V2=f[3])),
        dict(pma_years=12 + 40 / 52, weight_kg=40, scr_mg_dl=0.5, eta=[-0.4, 0.25, -0.1], heel=False, cancer=True, fitted=dict(CL=g[0], V1=g[1], Q=g[2], V2=g[3])),
    ]
    # B. ODE profiles
    profiles = []
    for label, pma, wgt, scr, schedule, times in [
        ("neonate 15 mg/kg q12h x4, 1 h infusions", (32 + 10 / 7) / 52, 1.5, 0.64, [(0, 22.5, 1), (12, 22.5, 1), (24, 22.5, 1), (36, 22.5, 1)], [0.5, 1.0, 1.5, 6.0, 12.0, 24.0, 37.0, 47.5, 48.0]),
        ("child 15 mg/kg q6h x8 incl. 1.5 h infusions", 6 + 40 / 52, 20, 0.4, [(6 * i, 300, 1.5) for i in range(8)], [1.5, 3.0, 5.9, 6.0, 24.0, 43.5, 47.0, 47.9]),
        ("adolescent loading 25 mg/kg then 15 mg/kg q8h, irregular timing", 15 + 40 / 52, 55, 0.8, [(0, 1375, 2.0), (8.5, 825, 1.0), (16.0, 825, 1.0), (25.0, 825, 1.0)], [2.0, 4.0, 8.0, 9.5, 20.0, 26.0, 33.0]),
    ]:
        p = params(pma, wgt, scr)
        prof = rk4_profile(p, schedule, times)
        profiles.append(dict(label=label, pma_years=pma, weight_kg=wgt, scr_mg_dl=scr, schedule=[dict(start_h=s, dose_mg=d, duration_h=u) for s, d, u in schedule],
                             parameters=dict(CL=p[0], V1=p[1], Q=p[2], V2=p[3]),
                             points=[dict(time_h=t, concentration=prof[t][0], cumulative_auc=prof[t][1]) for t in times]))
    cases['ode_profiles'] = profiles
    # C. MAP objective and optimum
    fits = []
    for label, pma, wgt, scr, schedule, obs in [
        ("child two levels (peak + trough after dose 6)", 6 + 40 / 52, 20, 0.4, [(6 * i, 300, 1.0) for i in range(6)], [(32.0, 22.0), (35.5, 9.0)]),
        ("neonate one trough after dose 3", (30 + 20 / 7) / 52, 1.2, 1.1, [(0, 18, 1.0), (18, 18, 1.0), (36, 18, 1.0)], [(53.5, 14.0)]),
        ("adolescent two levels, loading dose", 15 + 40 / 52, 55, 0.8, [(0, 1375, 2.0), (8.5, 825, 1.0), (16.0, 825, 1.0), (25.0, 825, 1.0)], [(27.0, 30.0), (33.0, 11.0)]),
    ]:
        fobj = lambda e, pma=pma, wgt=wgt, scr=scr, schedule=schedule, obs=obs: objective(e, pma, wgt, scr, schedule, obs)
        at_fixed = {tuple(e): fobj(list(e)) for e in [(0, 0, 0), (0.3, -0.2, 0.1), (-0.5, 0.4, -0.6)]}
        best, score = None, float('inf')
        for start in [(0, 0, 0), (0.5, 0, 0), (-0.5, 0, 0), (0, 0.5, 0), (0.4, 0.4, 0.4), (-0.4, -0.4, -0.4)]:
            x, s = nelder_mead(fobj, start)
            if s < score: best, score = x, s
        p = params(pma, wgt, scr, best)
        fits.append(dict(label=label, pma_years=pma, weight_kg=wgt, scr_mg_dl=scr,
                         schedule=[dict(start_h=s, dose_mg=d, duration_h=u) for s, d, u in schedule],
                         observations=[dict(time_h=t, concentration=y) for t, y in obs],
                         objective_at_eta=[dict(eta=list(e), objective=v) for e, v in at_fixed.items()],
                         map_eta=best, map_objective=score, map_parameters=dict(CL=p[0], V1=p[1], Q=p[2], V2=p[3])))
    cases['map_fits'] = fits
    # D. age convention and dataset boundaries (synthetic; expected outcomes independent of the engine)
    def expected_outcome(ga, pna_days):
        pma = pma_preview(ga, pna_days)
        if pna_days / DAYS_PER_YEAR >= ADULT_Y: return 'unsupported', 'patient.postnatal_age'
        if pma * 52 < 23.4: return 'unsupported', 'patient.gestational_age_weeks'
        if GAP_FROM < pma < GAP_TO: return 'unsupported', 'patient.postnatal_age'
        return 'ok', None
    def cl_per_day_sensitivity(pma, wgt, scr):
        a = params(pma, wgt, scr)[0]; b = params(pma + 1 / DAYS_PER_YEAR, wgt, scr)[0]
        return (b - a) / a
    gap_from_days_term = (GAP_FROM - 40 / 52) * DAYS_PER_YEAR
    gap_to_days_term = (GAP_TO - 40 / 52) * DAYS_PER_YEAR
    age_cases = []
    for label, ga, pna_days, wgt, scr in [
        ("reference individual: 35 y, GA 40 (PMA_R = 35 + 40/52)", 40, 35 * DAYS_PER_YEAR, 70, 0.83),
        ("PMA floor: GA 22 wk + 10 d (23.42 wk, accepted)", 22, 10, 0.5, 0.9),
        ("below PMA floor: GA 22 wk + 1 d (22.14 wk, refused)", 22, 1, 0.5, 0.9),
        ("GA 23.4 wk + 0 d (exactly the floor, accepted)", 23.4, 0, 0.5, 0.9),
        ("preterm: GA 28 wk + 84 d (clinical PMA 40.0 wk)", 28, 84, 2.0, 0.6),
        ("term neonate: GA 40 wk + 1 d", 40, 1, 3.4, 0.7),
        ("Oudin upper edge: GA 40 + 40 d (PMA 0.8787, accepted)", 40, 40, 4.0, 0.4),
        ("gap, term infant: GA 40 + 41 d (PMA 0.8815, refused)", 40, 41, 4.0, 0.4),
        ("gap, preterm infant: GA 24 + 150 d (PMA 0.872, accepted; 5 months postnatal)", 24, 150, 3.0, 0.4),
        ("gap, preterm infant: GA 24 + 160 d (PMA 0.900, refused)", 24, 160, 3.2, 0.4),
        ("gap, 12 months GA 40 (PMA 1.769, refused)", 40, 365.25, 9, 0.3),
        ("gap, 18 months GA 40 (PMA 2.269, refused)", 40, 1.5 * DAYS_PER_YEAR, 11, 0.3),
        ("van der Meer lower edge: GA 40 + 661 d (PMA 2.5789, refused)", 40, 661, 12, 0.35),
        ("van der Meer lower edge: GA 40 + 662 d (PMA 2.5816, accepted)", 40, 662, 12, 0.35),
        ("2.0 y postnatal, GA 40 (PMA 2.769 — above the gap, accepted)", 40, 2.0 * DAYS_PER_YEAR, 12, 0.35),
        ("6 y postnatal, GA 40 (6 + 40/52)", 40, 6 * DAYS_PER_YEAR, 20, 0.4),
        ("72 months postnatal, GA 40 (same as 6 y)", 40, 72 * DAYS_PER_YEAR / 12, 20, 0.4),
        ("17.999 y postnatal, GA 40 (accepted)", 40, 17.999 * DAYS_PER_YEAR, 70, 0.8),
        ("18.0 y postnatal, GA 40 (refused: adult)", 40, 18.0 * DAYS_PER_YEAR, 70, 0.8),
    ]:
        pma = pma_preview(ga, pna_days)
        status, field = expected_outcome(ga, pna_days)
        f = params(pma, wgt, scr) if status == 'ok' else None
        age_cases.append(dict(label=label, gestational_age_weeks=ga, postnatal_days=pna_days, weight_kg=wgt, scr_mg_dl=scr,
                              pma_years=pma, pma_weeks_model=pma * 52, pma_weeks_clinical=pma_clinical_weeks(ga, pna_days),
                              deviation_days=dict(clinical_over_52=(pma_clinical_weeks(ga, pna_days) / 52 - pma) * DAYS_PER_YEAR,
                                                  control_stream_identity=(pma_control_stream(ga, pna_days) - pma) * DAYS_PER_YEAR),
                              expected_status=status, expected_field=field,
                              fitted=(dict(CL=f[0], V1=f[1], Q=f[2], V2=f[3]) if f else None)))
    cases['age_convention'] = dict(
        convention="PMA_years = postnatal_days/365.25 + gestational_weeks/52",
        reference_pma_years=PMA_R,
        reference_reproduced=abs(pma_preview(40, 35 * DAYS_PER_YEAR) - PMA_R) < 1e-12,
        gap_open_interval_years=[GAP_FROM, GAP_TO],
        gap_postnatal_days_for_term_birth=[gap_from_days_term, gap_to_days_term],
        gap_postnatal_days_for_ga_24=[(GAP_FROM - 24 / 52) * DAYS_PER_YEAR, (GAP_TO - 24 / 52) * DAYS_PER_YEAR],
        max_abs_deviation_days_neonatal_range=dict(
            clinical_over_52=max(abs((pma_clinical_weeks(g, d) / 52 - pma_preview(g, d)) * DAYS_PER_YEAR) for g in (22, 30, 40, 44) for d in (1, 27, 95)),
            control_stream_identity=max(abs((pma_control_stream(g, d) - pma_preview(g, d)) * DAYS_PER_YEAR) for g in (22, 30, 40, 44) for d in (1, 27, 95))),
        max_abs_deviation_days_to_18y=dict(
            control_stream_identity=max(abs((pma_control_stream(40, d) - pma_preview(40, d)) * DAYS_PER_YEAR) for d in (661, 2 * 365.25, 10 * 365.25, 17.999 * 365.25))),
        cl_relative_change_per_day_of_pma=dict(
            pma_23_4_wk=cl_per_day_sensitivity(23.4 / 52, 0.5, 0.9), pma_30_wk=cl_per_day_sensitivity(30 / 52, 1.2, 0.8),
            pma_40_wk=cl_per_day_sensitivity(40 / 52, 3.4, 0.6), pma_6_y=cl_per_day_sensitivity(6 + 40 / 52, 20, 0.4), pma_17_y=cl_per_day_sensitivity(17 + 40 / 52, 60, 0.8)),
        cases=age_cases)
    cases['_meta'] = dict(purpose="independent reference for src/lib/pediatric (synthetic covariates only)",
                          ode="RK4, dt=0.002 h for profiles and 0.01 h inside the MAP objective, infusion edges aligned", nonmem_final_iteration=TH, omega=OMEGA, sigma=SIGMA)
    with open(out_path, 'w') as fh:
        json.dump(cases, fh, indent=1)
    print("wrote", os.path.normpath(out_path), "typical", len(typical), "profiles", len(profiles), "fits", len(fits), "age cases", len(age_cases))
    ac = cases['age_convention']
    print("age convention deviations (days):", json.dumps(ac['max_abs_deviation_days_neonatal_range']), json.dumps(ac['max_abs_deviation_days_to_18y']))
    print("CL change per day of PMA:", {k: f"{100*v:.3f}%" for k, v in ac['cl_relative_change_per_day_of_pma'].items()})
    print("gap in postnatal days (term):", [round(x, 1) for x in ac['gap_postnatal_days_for_term_birth']], "(GA 24):", [round(x, 1) for x in ac['gap_postnatal_days_for_ga_24']])
    for t in typical[:3]:
        print(f"{t['label'][:60]:60s} fitted CL {t['fitted']['CL']:.4f}  article CL {t['article']['CL']:.4f}")
    for f_ in fits:
        print(f"{f_['label'][:45]:45s} MAP eta {[round(e,4) for e in f_['map_eta']]} obj {f_['map_objective']:.6f}")

if __name__ == '__main__':
    main()
