# Vancomyzer

Production-ready vancomycin dosing calculator with two modes:
- Basic Calculator (Excel parity)
- Bayesian AUC Engine (MAP, optional posterior band)

Educational use only. Do not enter PHI.

## Architecture

Monorepo:
- `backend/` FastAPI API + SPA static hosting
- `src/` Vite + React + TypeScript + shadcn/ui
- `data/` Excel inputs, parsed JSON, priors

The backend serves the built SPA from `backend/static/` and exposes `/api` endpoints.

## Local development

Backend:
```sh
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r backend/requirements.txt
python -m uvicorn backend.server:app --host 0.0.0.0 --port 8000
```

Frontend:
```sh
npm ci
npm run dev
```

## Excel parsing (Basic Calculator)

Parse the provided XLSX into deterministic JSON:
```sh
python3 scripts/parse_basic_excel.py path/to/Vanco_Dosing.xlsx
```

Output:
- `data/parsed/basic_workbook.json`

The Basic Calculator uses the parsed workbook at runtime. If `data/parsed/basic_workbook.json` is missing, it falls back to `data/xlsx_dump/`.

## Priors (Bayesian AUC Engine)

Priors live in:
- `data/priors.json`

These include log-normal priors for CL and V and residual error defaults. Adjust as needed for population updates.

## API endpoints

Health:
- `GET /api/health` -> `{ "status": "ok" }`

Basic Calculator (Excel parity):
- `POST /api/basic/calculate`

Bayesian AUC Engine (MAP):
- `POST /api/pk/calculate`

Educational endpoint (legacy):
- `POST /api/pk/educational`

## Guideline alignment

The Bayesian mode targets AUC/MIC 400–600 (assuming MIC 1 mg/L) and applies dosing guardrails (loading and daily caps) aligned with the 2020 ASHP/IDSA/PIDS consensus guideline. See the guideline for full clinical context:  
https://www.ashp.org/-/media/assets/policy-guidelines/docs/therapeutic-guidelines/therapeutic-guidelines-monitoring-vancomycin-ASHP-IDSA-PIDS.pdf

## Tests

```sh
python -m pytest backend/tests
```

## Render deployment

Build command:
```sh
bash scripts/render_build.sh
```

Start command:
```sh
python -m uvicorn backend.server:app --host 0.0.0.0 --port $PORT
```

Health check:
- `GET /api/health`

## Disclaimer

Vancomyzer is for educational and clinical decision support only. It does not replace clinical judgment or institutional protocols.
