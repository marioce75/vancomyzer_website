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
