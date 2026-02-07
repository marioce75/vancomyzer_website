#!/usr/bin/env bash
set -euo pipefail

# Render build script: single Web Service (FastAPI + Vite static frontend)
# - Installs backend deps from backend/requirements.txt
# - Builds frontend into dist/
# - Copies dist/* into backend/static/ so FastAPI can serve it

python3 -m pip install --upgrade pip
python3 -m pip install -r backend/requirements.txt

npm ci
npm run build

mkdir -p backend/static
rm -rf backend/static/*
cp -R dist/* backend/static/

BUILD_TIME="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
GIT_SHA="${RENDER_GIT_COMMIT:-}"
if [ -z "$GIT_SHA" ]; then
  GIT_SHA="$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")"
fi

cat > backend/static/build-info.json <<EOF
{"git_sha":"$GIT_SHA","build_time":"$BUILD_TIME"}
EOF

echo "Render build complete: backend/static populated from dist/ (git=$GIT_SHA)"
