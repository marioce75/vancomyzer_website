# Vancomyzer (streamlined)

Lightweight vancomycin dosing calculator aligned with the 2020 ASHP/IDSA/PIDS/SIDP monitoring guideline.

## Run locally

Backend:
```
cd backend
uvicorn server:app --reload --port 8001
```

Frontend:
```
cd frontend
npm install
npm run start
```

## API endpoints

- `POST /api/calculate-dose` — guideline-based dosing using traditional PK equations.
- `POST /api/bayesian-dose` — uses observed level(s) to estimate patient-specific PK.
- Existing endpoints remain available under `server.py` (health check, PK simulation, etc.).

## Notes

- Targets AUC/MIC ≥ 400 mg·h/L (assumes MIC = 1 mg/L).
- Avoid AUC > 800 mg·h/L to reduce nephrotoxicity risk.
- Loading dose: 20–25 mg/kg ABW (max 3 g) for serious infections.
- Maintenance: 15–20 mg/kg with interval by CrCl (q8h >100, q12h 60–100, q24h <60).

## Math & Model Notes

Deterministic (Basic Calculator):
- Model: 1-compartment IV infusion with first-order elimination.
- Curve simulation: repeated doses over 0–48h at 10-minute resolution.
- Peak: concentration at end of infusion during the last interval in the 0–48h window.
- Trough: concentration just before the next dose (end of the last interval).
- AUC(0–24): trapezoidal integration of the simulated curve.

Bayesian (MAP fit):
- Model: 1-compartment IV infusion with first-order elimination.
- Priors: log-normal on CL and V (see `data/priors.json`).
- Residual error: additive + proportional error in the likelihood.
- Fit: MAP estimation of CL and V using measured levels against full dosing history.
- Uncertainty: Laplace approximation around MAP used to generate AUC and curve bands.

Assumptions:
- Times are hours from dose start.
- Infusion duration is required for MAP fitting.
- Dosing history is required; if missing, a regimen override is used to construct it.
