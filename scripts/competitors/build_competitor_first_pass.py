from pathlib import Path
import json
from datetime import datetime

COMPETITORS = ["vancocalc", "dosemerx", "insightrx", "precisepk"]
OUT = Path("reports/competitive-intel/COMPETITOR_FIRST_PASS.md")

def load_latest(name: str):
    path = Path(f"data/raw/competitors/{name}/latest_snapshot.json")
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))

lines = []
lines.append("# Vancomyzer Competitor First-Pass")
lines.append("")
lines.append(f"Generated: {datetime.utcnow().isoformat()}Z")
lines.append("")

for name in COMPETITORS:
    data = load_latest(name)
    lines.append(f"## {name}")
    if not data:
        lines.append("- No data available.")
        lines.append("")
        continue

    for item in data.get("results", []):
        if item.get("status") == "ok":
            excerpt = item.get("text_excerpt", "")[:800].replace("\n", " ")
            lines.append(f"- URL: {item.get('url','')}")
            lines.append(f"- SHA: {item.get('content_sha256','')[:12]}")
            lines.append(f"- Excerpt: {excerpt}")
        else:
            lines.append(f"- ERROR: {item.get('url','')} | {item.get('error','')}")
    lines.append("")

OUT.write_text("\n".join(lines), encoding="utf-8")
print(f"Wrote {OUT}")
