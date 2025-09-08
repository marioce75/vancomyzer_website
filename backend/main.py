import logging
from fastapi import FastAPI, APIRouter, Body, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from schemas import AucRequest

logger = logging.getLogger("vancomyzer")
logging.basicConfig(level=logging.INFO)

app = FastAPI(title="Vancomyzer API")
router = APIRouter(prefix="/api")

# CORS
origins = ["https://vancomyzer.com", "https://www.vancomyzer.com", "http://localhost:5173"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
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


@router.get("/interactive/auc")
async def interactive_auc_get(
    age_years: float | None = None,
    weight_kg: float | None = None,
    height_cm: float | None = None,
    scr_mg_dl: float | None = None,
    gender: str | None = None,
    dose_mg: float | None = None,
    interval_hr: float | None = None,
    infusion_minutes: float | None = 60.0,
    levels: str | None = None,  # JSON string for levels array
):
    # Parse levels if provided
    levels_list = None
    if levels:
        try:
            import json
            levels_list = json.loads(levels)
        except:
            levels_list = None
    
    req = AucRequest(
        age_years=age_years,
        weight_kg=weight_kg,
        height_cm=height_cm,
        scr_mg_dl=scr_mg_dl,
        gender=gender,
        dose_mg=dose_mg,
        interval_hr=interval_hr,
        infusion_minutes=infusion_minutes,
        levels=levels_list,
    )
    result = compute_auc_stub(req)
    return {"ok": True, "result": result}


app.include_router(router)

# Debug: print which methods are registered for /api/interactive/auc
@app.on_event("startup")
async def _print_routes_on_start():
    for r in app.router.routes:
        if getattr(r, "path", "") == "/api/interactive/auc":
            logger.info("REGISTERED METHODS for /api/interactive/auc: %s", getattr(r, "methods", None))
