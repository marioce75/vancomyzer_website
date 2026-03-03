# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

Vancomyzer is a clinical vancomycin dosing calculator with a Python FastAPI backend and a Vite + React (ShadCN/Tailwind) frontend. No database or external services are required — the app is purely computational (pharmacokinetic math using NumPy/SciPy).

### Required services

| Service | Command | Port |
|---|---|---|
| **FastAPI Backend** | `source backend/.venv/bin/activate && python -m uvicorn backend.main:app --host 0.0.0.0 --port 8001 --reload` (from repo root) | 8001 |
| **Vite Frontend** | `npm run dev` (from repo root) | 8080 |

### Key caveats

- **Python 3.11 is required.** The backend pins `numpy==1.24.3` and `scipy==1.11.3` which are incompatible with Python 3.12+. The venv at `backend/.venv` uses Python 3.11 (installed from the deadsnakes PPA).
- **Backend must run from the repo root** using `python -m uvicorn backend.main:app`, not from `backend/`. The server imports modules as `backend.pk.*`, `backend.regimen_recommender`, etc. which require the repo root on `sys.path`.
- **Frontend API base:** `src/lib/api.ts` hardcodes `API_BASE = ""` (empty string), meaning API calls are relative to the frontend origin. In production this works because the backend serves the frontend statically. In dev with separate Vite (8080) + backend (8001) servers, the frontend API calls hit port 8080 and 404. A Vite proxy or code change to use `import.meta.env.VITE_API_BASE` is needed for full frontend-backend communication in dev mode. The backend API itself works correctly and can be tested independently via curl.
- **CORS** is set to `allow_origins=["*"]` so no CORS configuration is needed for local dev.
- The `PatientInfo` model requires `serum_creatinine_mg_dl` as the field name (an alias for `serum_creatinine`). The frontend handles this mapping in `src/lib/api.ts`.

### Lint / Test / Build commands

See `package.json` scripts for frontend commands:
- Lint: `npm run lint`
- Test: `npm test` (vitest)
- Build: `npm run build`

Backend tests: `source backend/.venv/bin/activate && python -m pytest backend/tests/ -v` (from repo root).

### Optional: Legacy CRA frontend

A legacy MUI-based frontend lives in `frontend/`. It proxies API requests to `localhost:8001`. Install with `cd frontend && npm install`, run with `npm start`. This is not the primary UI.
