from pathlib import Path
from datetime import datetime, timezone
import json

OUTDIR = Path("data/raw/discussions")
OUTDIR.mkdir(parents=True, exist_ok=True)

payload = {
    "generated_at": datetime.now(timezone.utc).isoformat(),
    "source": "reddit",
    "status": "blocked_without_api_access",
    "recommended_next_step": "Use official Reddit API credentials or replace Reddit with alternative public discussion sources.",
    "alternatives": [
        "StudentDoctorNetwork public threads",
        "pharmacy and infectious disease blogs",
        "Google Alerts / RSS around vancomycin dosing topics",
        "continued PubMed monitoring",
        "public guideline/news pages"
    ]
}

timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
outfile = OUTDIR / f"reddit_results_{timestamp}.json"
latest = OUTDIR / "latest_reddit_results.json"

with open(outfile, "w", encoding="utf-8") as f:
    json.dump(payload, f, indent=2, ensure_ascii=False)

with open(latest, "w", encoding="utf-8") as f:
    json.dump(payload, f, indent=2, ensure_ascii=False)

print(f"Saved: {outfile}")
print(f"Updated: {latest}")
