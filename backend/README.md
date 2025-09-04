Vancomyzer Bayesian Backend (FastAPI + PyMC)
===========================================

Run locally
-----------

python -m pip install -r backend/requirements.txt
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload

Endpoints
---------
- GET /health → {"status":"ok"}
- POST /api/dose/interactive

Request (JSON)
--------------
{
  "population_type": "adult",
  "age": 56, // or age_years
  "gender": "male",
  "weight_kg": 79,
  "height_cm": 170,
  "serum_creatinine_mg_dl": 1.0, // or serum_creatinine
  "clcr_ml_min": null,           // optional; if missing, backend uses Cockcroft–Gault
  "levels": [
    { "time_hr": 2.0, "concentration_mg_L": 22.0, "tag": "post" },
    { "time_hr": 11.8, "concentration_mg_L": 12.3, "tag": "trough" }
  ],
  "regimen": { "dose_mg": 1000, "interval_hours": 12, "infusion_minutes": 60 },
  "mic_mg_L": 1.0
}

Response
--------
{
  "series": { "time_hours": [...], "median": [...], "p05": [...], "p95": [...] },
  "metrics": {
    "auc_24": 525.4,
    "predicted_peak": 32.1,
    "predicted_trough": 13.4,
    "auc24_over_mic": 525.4
  },
  "posterior": { "n_draws": 600, "CL_median_L_per_h": 3.9, "V_median_L": 52.0 },
  "diagnostics": {
    "predicted_levels": [{ "t": 2.0, "median": 21.7, "p05": 18.2, "p95": 25.9 }],
    "rhat_ok": true
  }
}

Smoke test
----------

curl -s -X POST http://127.0.0.1:8000/api/dose/interactive \
  -H 'Content-Type: application/json' \
  -d @backend/example_payload.json | jq . | head

Quick remote checks
-------------------

curl -i https://vancomyzer.onrender.com/api/health
curl -i -X POST https://vancomyzer.onrender.com/api/interactive/auc \
  -H "Content-Type: application/json" \
  -d '{"age_years":55,"weight_kg":72,"scr_mg_dl":1.0,"dose_mg":1500,"interval_hr":24}'
