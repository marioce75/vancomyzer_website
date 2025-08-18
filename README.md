Vancomyzer — Interactive AUC (Backend: FastAPI+PyMC, Frontend: React+MUI)
=======================================================================

Overview
--------
Single-surface, production-ready Interactive AUC experience for vancomycin dosing.
- Backend: FastAPI + PyMC Bayesian posterior for CL, V; vectorized PK simulation; caching.
- Frontend: React + MUI + Chart.js; median curve + 90% CI, dose markers, AUC shading; export PDF.

Repo layout
-----------
- backend/ … FastAPI app (`backend.main:app`), Bayesian model, PK engine, tests
- frontend/ … React app (single page Interactive AUC)
- vancomyzer/ … iOS client (separate)

Run locally
-----------
Backend
- Python 3.10+
- Create venv and install deps
  python -m venv .venv
  source .venv/bin/activate
  python -m pip install -r backend/requirements.txt
- Start API
  .venv/bin/uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
- Smoke test
  curl -s -X POST http://127.0.0.1:8000/api/dose/interactive -H 'Content-Type: application/json' -d @backend/example_payload.json | jq . | head

Frontend
- Node 18+
  cd frontend
  npm install
  REACT_APP_API_BASE=http://127.0.0.1:8000 npm start
- Open http://localhost:3000

Backend tests
- Activate venv and run
  pytest backend/tests -q

API contract (summary)
----------------------
- GET /health → {"status":"ok"}
- POST /api/dose/interactive
  Request: flat patient (age, gender, weight_kg, height_cm, serum_creatinine[_mg_dl], optional clcr_ml_min), levels[{time_hr, concentration_mg_L, tag?}], regimen{dose_mg, interval_hours, infusion_minutes}, mic_mg_L
  Response: { series{time_hours, median, p05, p95}, metrics{auc_24, predicted_peak, predicted_trough, auc24_over_mic}, posterior{n_draws, CL_median_L_per_h, V_median_L}, diagnostics{predicted_levels[{t, median, p05, p95}], rhat_ok} }

Deployment (Render)
-------------------
Backend (Web Service)
- Root: backend
- Build: pip install -r backend/requirements.txt
- Start: uvicorn backend.main:app --host 0.0.0.0 --port $PORT
- (Optional) Environment: PYTHON_VERSION=3.10

Frontend (Static Site)
- Root: frontend
- Build: npm ci && npm run build
- Publish dir: build
- Environment: REACT_APP_API_BASE=https://<your-backend>.onrender.com

Notes
-----
- Interactive AUC page debounces regimen changes (400 ms) and reuses posterior across same patient+levels (server cache).
- Badge shows Bayesian (n=…) indicating posterior draw count; CI is 90% band.
- Export PDF via toolbar, Copy JSON for payload/result.
- For full backend docs see backend/README.md.
