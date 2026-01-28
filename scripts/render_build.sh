#!/usr/bin/env bash
set -euo pipefail

# Render build script: single Web Service (FastAPI + Vite static frontend)
# - Installs backend deps from backend/requirements.txt
# - Builds frontend into dist/
# - Copies dist/* into backend/static/ so FastAPI can serve it

python -m pip install --upgrade pip
python -m pip install -r backend/requirements.txt

npm ci
npm run build

mkdir -p backend/static
rm -rf backend/static/*
cp -R dist/* backend/static/

echo "Render build complete: backend/static populated from dist/"
