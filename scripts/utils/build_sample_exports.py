from pathlib import Path
from datetime import datetime
import json

case_path = Path("data/cases/case_library_seed.json")
out_dir = Path("reports/documentation/examples")
out_dir.mkdir(parents=True, exist_ok=True)

if not case_path.exists():
    raise SystemExit(f"Missing {case_path}")

data = json.loads(case_path.read_text(encoding="utf-8"))
cases = data.get("cases", [])

def quick_summary(case):
    return f"""Recommendation: Example regimen placeholder for {case['case_id']}
Estimated AUC: Example AUC placeholder
Estimated trough: Example trough placeholder
Method: Bayesian/AUC-guided example summary
Key assumptions: Example assumptions based on {case['title']}
Cautions: Example caution notes for review
"""

def clinical_note(case):
    return f"""Patient/scenario: {case['title']}
Inputs used: Example input summary placeholder
Method: Bayesian/AUC-guided example method
Recommendation: Example regimen placeholder
Why this recommendation was made: Example rationale tied to scenario
Assumptions: Example assumptions based on available data
Limitations: Example limitations and uncertainty notes
Safety notes: Example safety notes requiring clinician review
"""

def educational_case(case):
    teaching = "; ".join(case.get("teaching_points", []))
    return f"""Case: {case['case_id']} — {case['title']}
Scenario: {case['scenario']}
Teaching points: {teaching}
Interpretation: Example interpretation summary for educational use
Why transparency matters here: Example explanation of how visible assumptions improve trust
"""

index_lines = []
index_lines.append("# Vancomyzer Sample Export Library")
index_lines.append("")
index_lines.append(f"Generated: {datetime.utcnow().isoformat()}Z")
index_lines.append("")

for case in cases:
    cid = case["case_id"]
    quick_file = out_dir / f"{cid}_quick_summary.md"
    note_file = out_dir / f"{cid}_clinical_note.md"
    edu_file = out_dir / f"{cid}_educational_case.md"

    quick_file.write_text(quick_summary(case), encoding="utf-8")
    note_file.write_text(clinical_note(case), encoding="utf-8")
    edu_file.write_text(educational_case(case), encoding="utf-8")

    index_lines.append(f"## {cid} — {case['title']}")
    index_lines.append(f"- {quick_file.name}")
    index_lines.append(f"- {note_file.name}")
    index_lines.append(f"- {edu_file.name}")
    index_lines.append("")

index_file = out_dir / "INDEX.md"
index_file.write_text("\n".join(index_lines), encoding="utf-8")

print(f"Wrote sample exports to {out_dir}")
print(f"Wrote {index_file}")
