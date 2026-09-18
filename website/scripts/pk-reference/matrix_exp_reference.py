#!/usr/bin/env python3
"""
Independent numerical reference ("oracle") for the vancomycin two-compartment
PK engine, built from primary equations with numpy/scipy matrix exponentials.

This file deliberately shares NO code with the TypeScript engine. Everything
is derived from:

  Colin PJ et al. Vancomycin pharmacokinetics throughout life: results from a
  pooled population analysis and evaluation of current dosing recommendations.
  Clin Pharmacokinet. 2019;58(6):767-780. DOI 10.1007/s40262-018-0727-5

Model (units: mg, L, h, mg/L == mcg/mL, SCr in mg/dL, age in years):
  CL = 5.31 * (WT/70)^0.75 * FMat * FDecline * FSCR
  V1 = 42.9 * (WT/70)
  V2 = 41.7 * (WT/70)
  Q  = 3.22 * (WT/70)^0.75
  PMA(yr) = age + 40/52 ; PMA(wk) = 52 * PMA(yr)
  FMat     = PMAwk^2.89 / (PMAwk^2.89 + 46.4^2.89)
  FDecline = 1 / (1 + (PMA/61.6)^2.24)
  SCRstd   = exp(-1.228 + 0.672*log10(PMA) + 6.27*exp(-3.11*PMA))
  FSCR     = exp(-0.649*(SCr - SCRstd))

State-space form (amounts A1 central, A2 peripheral, mg):
  dA1/dt = R(t) - (k10 + k12) A1 + k21 A2
  dA2/dt = k12 A1 - k21 A2
  C = A1 / V1
with k10 = CL/V1, k12 = Q/V1, k21 = Q/V2 and R(t) = dose/T_inf during an
infusion, 0 otherwise.

Numerics: the ODE is linear with piecewise-constant input, so it is solved
EXACTLY (to floating-point round-off) with expm on an augmented system
  y = [A1, A2, AUC, 1]^T,  dy/dt = M y,
  M = [[-(k10+k12), k21, 0, R],
       [k12,       -k21, 0, 0],
       [1/V1,        0,  0, 0],
       [0,           0,  0, 0]]
The third state integrates C = A1/V1, so AUC over any window is analytic, not
a quadrature. Tolerance: expm on a 4x4 well-conditioned matrix is accurate to
~1e-13 relative; a Richardson-checked trapezoid AUC is also computed and
reported (for transparency) and agrees to <1e-8 relative.

Steady state is obtained by LONG SIMULATION (>= 45 terminal half-lives and
>= 200 doses), never by the closed-form accumulation factor, so that the
closed-form TypeScript oracle and the production engine are checked against
something that does not share their algebra.

Output: scripts/pk-reference/fixtures.json (regenerate with
  python3 scripts/pk-reference/matrix_exp_reference.py).
"""

from __future__ import annotations

import json
import math
import os
import sys
from typing import Dict, List, Sequence, Tuple

try:
    import numpy as np
    from scipy.linalg import expm
except ImportError:  # pragma: no cover
    sys.stderr.write(
        "numpy/scipy missing: pip install --break-system-packages numpy scipy\n"
    )
    raise

# ── Colin 2019 fixed effects ─────────────────────────────────────────────────
THETA_CL = 5.31
THETA_V1 = 42.9
THETA_V2 = 41.7
THETA_Q = 3.22
PMA50_WK = 46.4
GAMMA1 = 2.89
AGE50_YR = 61.6
GAMMA2 = 2.24
THETA_SCR = 0.649


def colin_prior(age: float, weight_kg: float, scr_mg_dl: float) -> Dict[str, float]:
    pma_yr = age + 40.0 / 52.0
    pma_wk = pma_yr * 52.0
    f_size = weight_kg / 70.0
    f_mat = pma_wk ** GAMMA1 / (pma_wk ** GAMMA1 + PMA50_WK ** GAMMA1)
    f_decline = 1.0 / (1.0 + (pma_yr / AGE50_YR) ** GAMMA2)
    scr_std = math.exp(-1.228 + 0.672 * math.log10(pma_yr) + 6.27 * math.exp(-3.11 * pma_yr))
    f_scr = math.exp(-THETA_SCR * (scr_mg_dl - scr_std))
    return {
        "CL": THETA_CL * f_size ** 0.75 * f_mat * f_decline * f_scr,
        "V1": THETA_V1 * f_size,
        "V2": THETA_V2 * f_size,
        "Q": THETA_Q * f_size ** 0.75,
        "FMat": f_mat,
        "FDecline": f_decline,
        "SCRstd": scr_std,
        "FSCR": f_scr,
        "PMA_years": pma_yr,
    }


# ── Linear system ────────────────────────────────────────────────────────────
class TwoComp:
    def __init__(self, CL: float, V1: float, Q: float, V2: float):
        self.CL, self.V1, self.Q, self.V2 = CL, V1, Q, V2
        self.k10 = CL / V1
        self.k12 = Q / V1
        self.k21 = Q / V2

    def _M(self, rate: float) -> np.ndarray:
        k10, k12, k21, V1 = self.k10, self.k12, self.k21, self.V1
        return np.array(
            [
                [-(k10 + k12), k21, 0.0, rate],
                [k12, -k21, 0.0, 0.0],
                [1.0 / V1, 0.0, 0.0, 0.0],
                [0.0, 0.0, 0.0, 0.0],
            ]
        )

    def propagate(self, y: np.ndarray, dt: float, rate: float) -> np.ndarray:
        """y = [A1, A2, AUC, 1]; exact propagation over dt with constant input."""
        if dt <= 0:
            return y.copy()
        return expm(self._M(rate) * dt) @ y

    def terminal_half_life(self) -> float:
        s = self.k10 + self.k12 + self.k21
        disc = math.sqrt(max(0.0, s * s - 4 * self.k10 * self.k21))
        beta = (s - disc) / 2
        return math.log(2) / beta


Dose = Tuple[float, float, float]  # (time_h, dose_mg, T_inf_h)
MAX_SS_DOSES = 20000


def _breakpoints(schedule: Sequence[Dose]) -> List[float]:
    pts = set()
    for t0, _, tinf in schedule:
        pts.add(t0)
        pts.add(t0 + tinf)
    return sorted(pts)


def _rate_at(schedule: Sequence[Dose], t: float) -> float:
    """Total infusion rate in effect on the open interval starting at t."""
    r = 0.0
    for t0, dose, tinf in schedule:
        if t0 <= t < t0 + tinf:
            r += dose / tinf
    return r


def simulate(model: TwoComp, schedule: Sequence[Dose], times: Sequence[float]) -> Dict[str, np.ndarray]:
    """
    Exact state at each requested time (sorted ascending, >= 0).
    Returns concentration C (mg/L), A1, A2, cumulative AUC from t=0.
    """
    times = sorted(set(float(t) for t in times))
    bps = _breakpoints(schedule)
    events = sorted(set(bps) | set(times) | {0.0})
    y = np.array([0.0, 0.0, 0.0, 1.0])
    t_cur = 0.0
    out: Dict[float, np.ndarray] = {0.0: y.copy()}
    for t_next in events:
        if t_next <= t_cur:
            continue
        # input is constant on [t_cur, t_next) because both are breakpoints or
        # lie strictly between breakpoints
        y = model.propagate(y, t_next - t_cur, _rate_at(schedule, t_cur))
        t_cur = t_next
        out[t_cur] = y.copy()
    C = np.array([out[t][0] / model.V1 for t in times])
    A1 = np.array([out[t][0] for t in times])
    A2 = np.array([out[t][1] for t in times])
    AUC = np.array([out[t][2] for t in times])
    return {"t": np.array(times), "C": C, "A1": A1, "A2": A2, "AUC": AUC}


def auc_window(model: TwoComp, schedule: Sequence[Dose], a: float, b: float) -> float:
    r = simulate(model, schedule, [a, b])
    return float(r["AUC"][1] - r["AUC"][0])


def auc_trapezoid_richardson(model: TwoComp, schedule: Sequence[Dose], a: float, b: float, n: int = 4000) -> Tuple[float, float]:
    """Independent check: composite trapezoid with h and h/2, Richardson-extrapolated.
    Grid is aligned to include every infusion breakpoint inside [a, b]."""
    def trap(nn: int) -> float:
        base = list(np.linspace(a, b, nn + 1))
        bps = [p for p in _breakpoints(schedule) if a < p < b]
        grid = sorted(set(base) | set(bps))
        C = simulate(model, schedule, grid)["C"]
        g = np.array(grid)
        return float(np.sum((C[1:] + C[:-1]) / 2 * np.diff(g)))
    t1, t2 = trap(n), trap(2 * n)
    return (4 * t2 - t1) / 3, abs(t2 - t1)


def regular_schedule(dose: float, tau: float, tinf: float, n: int) -> List[Dose]:
    return [(k * tau, dose, tinf) for k in range(n)]


def steady_state_by_simulation(model: TwoComp, dose: float, tau: float, tinf: float) -> Dict[str, float]:
    """Long simulation: >= 45 terminal half-lives AND >= 200 doses."""
    t_half = model.terminal_half_life()
    n = max(200, int(math.ceil(45 * t_half / tau)) + 1)
    if n > MAX_SS_DOSES:  # pragma: no cover - guards absurd parameter sets
        raise ValueError(f"steady state would need {n} doses (t1/2 = {t_half:.3g} h); refusing")
    sched = regular_schedule(dose, tau, tinf, n)
    t_last = (n - 1) * tau
    # Also verify convergence: compare last interval vs. the one before it.
    r = simulate(
        model,
        sched,
        [t_last - tau, t_last - tau + tinf, t_last, t_last + tinf, t_last + tau],
    )
    peak_prev, trough_prev = r["C"][1], r["C"][2]
    peak, trough = r["C"][3], r["C"][4]
    auc_tau = float(r["AUC"][4] - r["AUC"][2])
    conv = max(abs(peak - peak_prev) / peak, abs(trough - trough_prev) / trough)
    return {
        "n_doses_simulated": n,
        "terminal_half_life_h": t_half,
        "half_lives_covered": n * tau / t_half,
        "peak_end_of_infusion": float(peak),
        "trough_end_of_interval": float(trough),
        "auc_tau": auc_tau,
        "auc24": auc_tau * 24.0 / tau,
        "auc24_linear_identity": dose / model.CL * 24.0 / tau,
        "convergence_rel_change_last_interval": float(conv),
    }


def finite_train(model: TwoComp, dose: float, tau: float, tinf: float, n: int) -> Dict[str, object]:
    sched = regular_schedule(dose, tau, tinf, n)
    t_end_inf_n = (n - 1) * tau + tinf
    t_end_n = n * tau
    grid = sorted(set([0.0, t_end_inf_n, t_end_n, 24.0, 48.0] + [k * tau for k in range(n + 1)] + [k * tau + tinf for k in range(n)] + [k * 0.5 for k in range(int(t_end_n * 2) + 1)]))
    r = simulate(model, sched, grid)
    idx = {t: i for i, t in enumerate(r["t"])}
    auc_0_24_exact = auc_window(model, sched, 0.0, min(24.0, t_end_n))
    auc_0_24_trap, trap_err = auc_trapezoid_richardson(model, sched, 0.0, min(24.0, t_end_n))
    total_infused = n * dose
    eliminated = model.CL * r["AUC"][idx[t_end_n]]
    in_body = r["A1"][idx[t_end_n]] + r["A2"][idx[t_end_n]]
    return {
        "n_doses": n,
        "peak_dose_n": float(r["C"][idx[t_end_inf_n]]),
        "trough_interval_n": float(r["C"][idx[t_end_n]]),
        "auc_0_to_24_exact": auc_0_24_exact,
        "auc_0_to_24_trapezoid_richardson": auc_0_24_trap,
        "auc_0_to_24_trapezoid_halving_diff": trap_err,
        "auc_0_to_end": float(r["AUC"][idx[t_end_n]]),
        "mass_balance": {
            "infused_mg": total_infused,
            "in_body_mg": float(in_body),
            "eliminated_mg": float(eliminated),
            "residual_mg": float(total_infused - in_body - eliminated),
        },
        "curve": [{"t": float(t), "C": float(c)} for t, c in zip(r["t"], r["C"])],
    }


def build_case(name: str, params: Dict[str, float], dose: float, tau: float, tinf: float, n_finite: int, patient: Dict[str, float] | None = None) -> Dict[str, object]:
    model = TwoComp(params["CL"], params["V1"], params["Q"], params["V2"])
    s = model.k10 + model.k12 + model.k21
    disc_sq = s * s - 4 * model.k10 * model.k21
    return {
        "name": name,
        "patient": patient,
        "params": {k: params[k] for k in ("CL", "V1", "Q", "V2")},
        "micro": {"k10": model.k10, "k12": model.k12, "k21": model.k21, "discriminant_sq": disc_sq},
        "regimen": {"dose_mg": dose, "tau_h": tau, "T_inf_h": tinf},
        "single_dose": {
            "curve": [
                {"t": float(t), "C": float(c)}
                for t, c in zip(*(lambda r: (r["t"], r["C"]))(simulate(model, [(0.0, dose, tinf)], sorted(set([0.0, tinf / 2, tinf, tinf + 1e-9, tinf + 1.0, 6.0, 12.0, 24.0, 48.0, 72.0] + [k * 0.25 for k in range(int(4 * max(24.0, 2 * tau)) + 1)])))))
            ],
            "auc_0_24_exact": auc_window(model, [(0.0, dose, tinf)], 0.0, 24.0),
            "auc_0_inf_exact_identity": dose / model.CL,
            "auc_0_500h_exact": auc_window(model, [(0.0, dose, tinf)], 0.0, 500.0),
        },
        "finite_train": finite_train(model, dose, tau, tinf, n_finite),
        "steady_state_long_simulation": steady_state_by_simulation(model, dose, tau, tinf),
    }


def main() -> None:
    here = os.path.dirname(os.path.abspath(__file__))
    ref_patient = {"age": 35, "weight_kg": 70, "scr_mg_dl": 0.83}
    ref = colin_prior(**ref_patient)

    cases: List[Dict[str, object]] = []
    # 1. Reference regimen (the values the test asserts by literal)
    cases.append(build_case("reference_1000_q12_1p75", ref, 1000, 12, 1.75, 6, ref_patient))
    # 2. Non-24h-divisible intervals
    cases.append(build_case("q18h_1250_1h", ref, 1250, 18, 1.0, 5, ref_patient))
    cases.append(build_case("q36h_1500_2h", ref, 1500, 36, 2.0, 4, ref_patient))
    # 3. Infusion durations 0.5 .. 4 h
    for tinf in (0.5, 1.0, 2.0, 3.0, 4.0):
        cases.append(build_case(f"q8h_750_tinf{tinf}", ref, 750, 8, tinf, 7, ref_patient))
    # 4. Slow elimination (CL 0.3 L/h, V1 40)
    slow = {"CL": 0.3, "V1": 40.0, "Q": 3.22, "V2": 41.7}
    cases.append(build_case("slow_CL0.3_V40_q24", slow, 1000, 24, 1.0, 5))
    # 5. alpha ~ beta guard. disc_sq = (k10+k12+k21)^2 - 4 k10 k21
    #    = (k10 - k21)^2 + k12^2 + 2 k12 (k10 + k21) >= k12^2 > 0, so the only
    #    way to make it tiny with a normal elimination rate is k10 == k21 and
    #    k12 = Q/V1 tiny. CL 4, V1 40 -> k10 = 0.1; Q 1e-5, V2 1e-4 -> k21 = 0.1,
    #    k12 = 2.5e-7, disc_sq ~ 1e-7 (alpha - beta ~ 3e-4 /h). The closed form
    #    divides by (alpha - beta), so this stresses cancellation; the matrix
    #    exponential does not care.
    V1, V2 = 40.0, 1e-4
    Q = 1e-5
    CL = 4.0  # k10 = 0.1 == k21 = Q/V2
    near = {"CL": CL, "V1": V1, "Q": Q, "V2": V2}
    cases.append(build_case("near_degenerate_alpha_eq_beta", near, 1000, 12, 1.0, 4))
    # 6. Other Colin patients
    for age, wt, scr in ((65, 90, 1.5), (25, 55, 0.6), (80, 110, 2.2), (45, 122.5, 0.83)):
        p = {"age": age, "weight_kg": wt, "scr_mg_dl": scr}
        cases.append(build_case(f"colin_age{age}_wt{wt}_scr{scr}_q12_1000_1h", colin_prior(**p), 1000, 12, 1.0, 6, p))

    bmi = {
        "age": 35,
        "height_cm": 175,
        "scr_mg_dl": 0.83,
        "weights": {
            "122.19375": colin_prior(35, 122.19375, 0.83)["CL"],
            "122.5": colin_prior(35, 122.5, 0.83)["CL"],
        },
        "expected_ratio": (122.5 / 122.19375) ** 0.75,
    }

    fixtures = {
        "source": "Colin et al. 2019 Clin Pharmacokinet 58:767, DOI 10.1007/s40262-018-0727-5",
        "generator": "scripts/pk-reference/matrix_exp_reference.py (scipy.linalg.expm on augmented 4-state linear system)",
        "units": {"dose": "mg", "volume": "L", "clearance": "L/h", "time": "h", "concentration": "mg/L (= mcg/mL)", "SCr": "mg/dL"},
        "tolerances": {
            "expm_exact_states": "~1e-13 relative (floating point only)",
            "trapezoid_richardson_auc": "reported diff between h and h/2 grids; used only as a cross-check",
            "steady_state_long_simulation": ">= 45 terminal half-lives and >= 200 doses; convergence_rel_change_last_interval reported per case",
        },
        "reference_prior": {"patient": ref_patient, **ref},
        "bmi_continuity": bmi,
        "cases": cases,
    }
    out = os.path.join(here, "fixtures.json")
    with open(out, "w") as fh:
        json.dump(fixtures, fh, indent=1)
    print(f"wrote {out} with {len(cases)} cases")
    c0 = cases[0]
    print("reference CL", ref["CL"])
    print("ss peak/trough/auc24", c0["steady_state_long_simulation"]["peak_end_of_infusion"], c0["steady_state_long_simulation"]["trough_end_of_interval"], c0["steady_state_long_simulation"]["auc24"])
    print("6-dose peak/trough", c0["finite_train"]["peak_dose_n"], c0["finite_train"]["trough_interval_n"])


if __name__ == "__main__":
    main()
