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
  Request: flat patient (age, gender, weight_kg, height_cm, serum_creatinine
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

## Deployment notes

- In Render → Static Site, set `VITE_API_BASE` (no trailing `/api`).
- Clear build cache & redeploy after changing environment variables.
- You can temporarily override the backend in the browser using `?api=https://host[:port]`.

Notes
-----
- Interactive AUC page debounces regimen changes (400 ms) and reuses posterior across same patient+levels (server cache).
- Badge shows Bayesian (n=…) indicating posterior draw count; CI is 90% band.
- Export PDF via toolbar, Copy JSON for payload/result.
- For full backend docs see backend/README.md.

Backend notes: Health route and CORS
------------------------------------
- Health endpoints:
  - `/health` (existing in `backend/main.py`)
  - `/api/health` (alias added for clients using a base URL ending with `/api`)
- Interactive AUC endpoints:
  - `/api/dose/interactive` (existing)
  - `/api/interactive/auc` (alias added)
- CORS: FastAPI app enables permissive CORS (allow_origins=['*']) in `backend/main.py` to simplify cross-origin requests from the Vite frontend.

Frontend configuration
----------------------
- Set `VITE_INTERACTIVE_API_URL` in `frontend/.env` or environment at build time. Example in `frontend/.env.example`.
- When `VITE_INTERACTIVE_API_URL` is unset or empty, the interactive Bayesian API is disabled and the app operates in offline mode using local PK computation.

Client-side behavior
--------------------
- A health check runs on mount calling `${VITE_INTERACTIVE_API_URL}/health` with a 2s timeout.
- All interactive requests use a 6s timeout, 3 attempts with backoff (250/500/1000ms), and `AbortController` cancellation.
- On normal slider changes while the endpoint is down, no red error banner is shown; instead, a small chip indicates "Bayesian optimization (offline)" and local compute is used.
- Only after the user explicitly presses Retry will a red error banner be displayed if the third attempt still fails.

## Bayesian backend (FastAPI) — local run
- Python 3.11 recommended
- Install deps:
  python -m pip install -r backend/requirements.txt
- Start API:
  uvicorn backend.app:app --reload --port 8000
- Health test:
  curl https://<render-url>/api/health

## Frontend env
- Set VITE_INTERACTIVE_API_URL=https://<render-url>/api
- Rebuild and redeploy frontend.

---

Quick verification (production)
- Health
  curl -i https://vancomyzer.onrender.com/api/health
- Interactive AUC (POST JSON)
  curl -i -X POST https://vancomyzer.onrender.com/api/interactive/auc \
       -H "Content-Type: application/json" \
       -d '{"age":55,"weight_kg":70,"scr_mg_dl":1.0,"dose_mg":1500,"interval_hr":24}'
  # Expect HTTP/200 and JSON body with {"ok": true, "result": {...}}

---

Concise curl examples
- Health
  curl -i https://vancomyzer.onrender.com/api/health
- Interactive AUC (POST JSON)
  curl -i -X POST https://vancomyzer.onrender.com/api/interactive/auc \
       -H "Content-Type: application/json" \
       -d '{"age_years":55,"weight_kg":72,"scr_mg_dl":1.0,"dose_mg":1500,"interval_hr":24}'
