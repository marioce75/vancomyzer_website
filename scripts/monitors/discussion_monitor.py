from pathlib import Path
import json
from datetime import datetime

OUT = Path("data/raw/discussions")
OUT.mkdir(parents=True, exist_ok=True)

sample = {
    "generated_at": datetime.utcnow().isoformat() + "Z",
    "status": "scaffold_only",
    "next_step": "Implement compliant collection plan for public discussion sources."
}

with open(OUT / "discussion_scaffold.json", "w") as f:
    json.dump(sample, f, indent=2)

print(f"Wrote {OUT / 'discussion_scaffold.json'}")
