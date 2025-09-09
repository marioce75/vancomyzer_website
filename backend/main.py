import logging
from fastapi import FastAPI, APIRouter, Body, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from schemas import AucRequest

logger = logging.getLogger("vancomyzer")
logging.basicConfig(level=logging.INFO)

app = FastAPI(title="Vancomyzer API")
router = APIRouter(prefix="/api")

# CORS
origins = ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@router.get("/health")
async def health():
    return {"status": "ok"}


# TEMP compute: replace with real Bayesian compute after POST is verified
def compute_auc_stub(req: AucRequest) -> dict:
    return {
        "auc_24": 0.0,
        "predicted_peak": None,
        "predicted_trough": None,
        "series": {"time_hours": [], "concentration_mg_L": []},
    }


@router.post("/interactive/auc")
async def interactive_auc_post(req: AucRequest = Body(...)):
    try:
        logger.info("AUC POST payload: %s", req.model_dump())
        result = compute_auc_stub(req)  # TODO: swap in real engine
        return {"ok": True, "result": result}
    except Exception as e:
        logger.exception("AUC compute failed")
        raise HTTPException(status_code=400, detail=str(e))


app.include_router(router)

# Debug: print which methods are registered for /api/interactive/auc
@app.on_event("startup")
async def _print_routes_on_start():
    for r in app.router.routes:
        if getattr(r, "path", "") == "/api/interactive/auc":
            logger.info("REGISTERED METHODS for /api/interactive/auc: %s", getattr(r, "methods", None))
