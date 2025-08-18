#!/usr/bin/env bash
set -euo pipefail
export PORT="${PORT:-8000}"
exec uvicorn app:app --host 0.0.0.0 --port "$PORT" --reload
