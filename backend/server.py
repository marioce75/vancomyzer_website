from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from pathlib import Path

app = FastAPI()

# Serve built frontend from backend/static
app.mount("/static", StaticFiles(directory="backend/static"), name="static")

@app.get("/", response_class=HTMLResponse)
def serve_frontend():
    return Path("backend/static/index.html").read_text()

# Note: API routes remain under /api/* in other modules (e.g., main.py)
