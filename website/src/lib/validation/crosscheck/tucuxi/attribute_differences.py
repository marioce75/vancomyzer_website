#!/usr/bin/env python3
"""
Attribution of Vancomyzer-vs-Tucuxi posterior differences to the residual
error-model FORM (acceptance-criteria.md: every tail case must be explained).

Independent MAP refit (numpy/scipy, matrix-exponential steady state — shares no
code with either engine) of each patient with |dCL| above a threshold, under
  (V) sigma = max(1, 0.15 * max(obs, pred))          -- Vancomyzer's form
  (T) sigma = sqrt((0.15 * pred)^2 + 1^2)            -- Tucuxi 'mixed' form
Same prior (Colin 2019 typical values, log-normal omega 0.35/0.25/0.5/0.5), same
data, same steady-state horizon. If refit (V) reproduces Vancomyzer's posterior
and refit (T) reproduces Tucuxi's, the difference is the error-model form and
not an optimiser or model-integration defect.

  python3 attribute_differences.py [--threshold 3]
"""
import argparse, json, math, os, sys
import numpy as np
from scipy.linalg import expm
from scipy.optimize import minimize

HERE = os.path.dirname(os.path.abspath(__file__)); CC = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(CC, "..", "..", "..", "..", "scripts", "pk-reference"))
from matrix_exp_reference import colin_prior  # independent Colin implementation

OMEGA = np.array([0.35, 0.25, 0.5, 0.5])

def ss_conc(CL, V1, Q, V2, dose, tau, tinf, times):
    """Exact steady-state concentration at `times` (h after dose start)."""
    k10, k12, k21 = CL / V1, Q / V1, Q / V2
    def M(rate):
        return np.array([[-(k10 + k12), k21, rate], [k12, -k21, 0.0], [0.0, 0.0, 0.0]])
    E1 = expm(M(dose / tinf) * tinf); E2 = expm(M(0.0) * (tau - tinf))
    T = E2 @ E1
    x0 = np.linalg.solve(np.eye(2) - T[:2, :2], T[:2, 2])  # state at dose start, SS
    y0 = np.array([x0[0], x0[1], 1.0])
    out = []
    for t in times:
        if t <= tinf: y = expm(M(dose / tinf) * t) @ y0
        else: y = expm(M(0.0) * (t - tinf)) @ (E1 @ y0)
        out.append(y[0] / V1)
    return np.array(out)

def sigma_v(obs, pred): return np.maximum(1.0, 0.15 * np.maximum(obs, pred))
def sigma_t(obs, pred): return np.sqrt((0.15 * pred) ** 2 + 1.0)

def fit(prior, dose, tau, tinf, times, obs, sigma_fn):
    lp0 = np.log(prior)
    def obj(lp):
        th = np.exp(lp)
        pred = ss_conc(*th, dose, tau, tinf, times)
        s = sigma_fn(obs, pred)
        z = (obs - pred) / s
        return float(np.sum(0.5 * z * z + np.log(s)) + np.sum((lp - lp0) ** 2 / (2 * OMEGA ** 2)))
    best = None
    for start in (lp0, lp0 + np.array([0.3, 0, 0, 0]), lp0 - np.array([0.3, 0, 0, 0]), lp0 + np.array([0, 0.2, 0, 0]), lp0 - np.array([0.2, -0.2, 0, 0])):
        r = minimize(obj, start, method="Nelder-Mead", options={"xatol": 1e-8, "fatol": 1e-10, "maxiter": 4000})
        if best is None or r.fun < best.fun: best = r
    return np.exp(best.x), best.fun

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--threshold", type=float, default=3.0)
    ap.add_argument("--vanco", default="vancomyzer-2026-09-17.1-crosscheck-seed42-n200.json")
    ap.add_argument("--tucuxi", default="tucuxi-49f6ebe6bcb3-crosscheck-seed42-n200.json")
    a = ap.parse_args()
    fx = {p["id"]: p for p in json.load(open(os.path.join(CC, "fixtures", "crosscheck-seed42-n200.json")))["patients"]}
    V = json.load(open(os.path.join(CC, "results", a.vanco)))["results"]
    T = {r["id"]: r for r in json.load(open(os.path.join(CC, "results", a.tucuxi)))["results"]}
    rows = []
    for v in V:
        t = T[v["id"]]; d = 100 * (v["posterior"]["CL"] - t["posterior"]["CL"]) / t["posterior"]["CL"]
        if abs(d) >= a.threshold: rows.append((v, t, d))
    rows.sort(key=lambda r: -abs(r[2]))
    print(f"{len(rows)} patients with |dCL| >= {a.threshold}% (Vancomyzer vs Tucuxi)")
    out = []
    for v, t, d in rows:
        p = fx[v["id"]]; P = p["patient"]; R = p["regimen"]
        prior = colin_prior(P["age"], P["weight_kg"], P["serum_creatinine_mg_dl"])
        pr = np.array([prior["CL"], prior["V1"], prior["Q"], prior["V2"]])
        times = np.array([l["time_since_last_dose_hours"] for l in p["levels"]]); obs = np.array([l["value_mcg_ml"] for l in p["levels"]])
        thV, _ = fit(pr, R["dose_mg"], R["interval_hours"], R["infusion_duration_hours"], times, obs, sigma_v)
        thT, _ = fit(pr, R["dose_mg"], R["interval_hours"], R["infusion_duration_hours"], times, obs, sigma_t)
        eVV = 100 * (thV[0] - v["posterior"]["CL"]) / v["posterior"]["CL"]   # refit(V) vs Vancomyzer
        eTT = 100 * (thT[0] - t["posterior"]["CL"]) / t["posterior"]["CL"]   # refit(T) vs Tucuxi
        eVT = 100 * (thV[0] - thT[0]) / thT[0]                              # form effect alone
        out.append({"id": v["id"], "dCL_pct_vanco_vs_tucuxi": d, "refit_vform_CL": thV[0], "refit_tform_CL": thT[0],
                    "refit_vform_vs_vancomyzer_pct": eVV, "refit_tform_vs_tucuxi_pct": eTT, "form_effect_pct": eVT,
                    "vancomyzer_CL": v["posterior"]["CL"], "tucuxi_CL": t["posterior"]["CL"], "fit_quality": v["fit"]["quality"]})
        print(f"{v['id']:>5} dCL {d:6.2f}% | refit(V) vs Vancomyzer {eVV:6.2f}% | refit(T) vs Tucuxi {eTT:6.2f}% | form effect alone {eVT:6.2f}%")
    path = os.path.join(CC, "results", f"attribution-{a.vanco.replace('.json','')}-vs-{a.tucuxi.replace('.json','')}.json")
    json.dump({"threshold_pct": a.threshold, "method": __doc__.strip(), "cases": out}, open(path, "w"), indent=1)
    print("wrote", path)

if __name__ == "__main__": main()
