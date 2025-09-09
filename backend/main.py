import logging
from fastapi import FastAPI, APIRouter, Body, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from schemas import AucRequest

log = logging.getLogger("vancomyzer")
logging.basicConfig(level=logging.INFO)

app = FastAPI(title="Vancomyzer API")

# CORS (explicit origins as requested)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://vancomyzer.com",
        "https://www.vancomyzer.com",
        "https://vancomyzer.onrender.com",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

# Routers
api_router = APIRouter(prefix="/api")
root_router = APIRouter()


@api_router.get("/health")
async def health_api():
    return {"status": "ok"}


# TEMP compute: replace with real Bayesian compute after POST is verified
def compute_auc_stub(req: AucRequest) -> dict:
    return {
        "auc_24": 0.0,
        "predicted_peak": None,
        "predicted_trough": None,
        "series": {"time_hours": [], "concentration_mg_L": []},
    }


@api_router.post("/interactive/auc")
async def auc_api(req: AucRequest = Body(...)):
    try:
        log.info("AUC POST payload: %s", req.model_dump())
        result = compute_auc_stub(req)  # TODO: swap in real engine
        return {"ok": True, "result": result}
    except Exception as e:
        log.exception("AUC compute failed")
        raise HTTPException(status_code=400, detail=str(e))


# ----- Root aliases (no prefix) -----
@root_router.get("/health")
async def health_root():
    return await health_api()


@root_router.post("/interactive/auc")
async def auc_root(req: AucRequest = Body(...)):
    return await auc_api(req)


# Include routers once
app.include_router(api_router)
app.include_router(root_router)


# Startup: log registered methods for both prefixed and root paths
@app.on_event("startup")
async def _debug_routes():
    paths = {"/api/health", "/api/interactive/auc", "/health", "/interactive/auc"}
    for r in app.router.routes:
        p = getattr(r, "path", "")
        if p in paths:
            log.info("ROUTE %s -> methods=%s name=%s", p, getattr(r, "methods", None), getattr(r, "name", None))
