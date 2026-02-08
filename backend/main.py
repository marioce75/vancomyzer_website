"""
Entry point for Render/uvicorn.

Render currently starts the app with:
  python -m uvicorn backend.main:app --host 0.0.0.0 --port 8001

To avoid losing the full calculation endpoints, re-export the real
FastAPI app defined in backend.server.
"""

from backend.server import app  # re-export for uvicorn
