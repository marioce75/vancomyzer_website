Vancomyzer Bayesian Backend (FastAPI + PyMC)
===========================================

Run locally
-----------

python -m pip install -r backend/requirements.txt
uvicorn backend.main:app --host 0.0.0.0 --port 8000

Endpoints
---------
- GET /health
- POST /api/dose/interactive

Example
-------

curl -s -X POST http://127.0.0.1:8000/api/dose/interactive \
  -H 'Content-Type: application/json' \
  -d @backend/example_payload.json | jq . | head
