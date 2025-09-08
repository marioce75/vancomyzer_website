#!/usr/bin/env bash
set -euo pipefail

# Portable dev runner for Vancomyzer backend
# Usage: ./run.sh (from repo root) or ../run.sh (from backend/)

SRC_DIR="$( cd -- "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd "$SRC_DIR"

# Move into backend if we aren't already there
if [[ "$(basename "$PWD")" != "backend" ]]; then
  if [[ -d "backend" ]]; then
    cd backend
  else
    echo "❌ Could not find backend/ next to run.sh. Current dir: $PWD"
    exit 1
  fi
fi

# Locate venv
# Prefer project root .venv (../.venv) but support backend-local .venv fallback
VENV_ROOT="../.venv"
[[ -d "$VENV_ROOT" ]] || VENV_ROOT=".venv"

if [[ -d "$VENV_ROOT" ]]; then
  # shellcheck disable=SC1091
  source "$VENV_ROOT/bin/activate"
  echo "✅ Activated venv at: $VENV_ROOT"
else
  echo "⚠️  No virtualenv found at ../.venv or ./.venv"
  echo "   Run:  make venv"
  exit 1
fi

# Sanity check: main.py present
if [[ ! -f "main.py" ]]; then
  echo "❌ backend/main.py not found. You appear to be in: $PWD"
  exit 1
fi

echo "🚀 Starting API: python -m uvicorn main:app --reload"
echo "🔎 After it starts, try:"
echo "   curl -i http://127.0.0.1:8000/api/health"
echo "   curl -i -X POST http://127.0.0.1:8000/api/interactive/auc -H 'Content-Type: application/json' -d '{\"dose_mg\":1000,\"interval_hr\":12}'"

exec python -m uvicorn main:app --reload
