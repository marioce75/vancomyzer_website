from pathlib import Path
from datetime import datetime
import json

case_path = Path("data/cases/case_library_seed.json")
out = Path("reports/case-pages/VANCOMYZER_CASE_PAGES.md")

if not case_path.exists():
    raise SystemExit(f"Missing {case_path}")

data = json.loads(case_path.read_text(encoding="utf-8"))
cases = data.get("cases", [])

lines = []
lines.append("# Vancomyzer Case Pages")
lines.append("")
lines.append(f"Generated: {datetime.utcnow().isoformat()}Z")
lines.append("")

for case in cases:
    cid = case["case_id"]
    title = case["title"]
    scenario = case["scenario"]
    teaching_points = case.get("teaching_points", [])

    slug = cid.lower().replace("case-", "case-")
    lines.append(f"## {title}")
    lines.append(f"Suggested slug: /cases/{slug}")
    lines.append("")
    lines.append("### Hero")
    lines.append(title)
    lines.append("")
    lines.append("### Scenario summary")
    lines.append(scenario)
    lines.append("")
    lines.append("### What this case teaches")
    for tp in teaching_points:
        lines.append(f"- {tp}")
    lines.append("")
    lines.append("### Recommended page sections")
    lines.append("- Case overview")
    lines.append("- Key interpretation points")
    lines.append("- Visible assumptions and limitations")
    lines.append("- Documentation/export example")
    lines.append("- CTA to explore workflow or related case")
    lines.append("")
    lines.append("### Messaging guardrails")
    lines.append("- Keep educational tone")
    lines.append("- Avoid overclaiming clinical conclusions")
    lines.append("- Make uncertainty and assumptions visible")
    lines.append("")

out.parent.mkdir(parents=True, exist_ok=True)
out.write_text("\n".join(lines), encoding="utf-8")
print(f"Wrote {out}")
