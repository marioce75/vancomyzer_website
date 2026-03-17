from pathlib import Path
from datetime import datetime
import json

cases = [
    {
        "case_id": "CASE-001",
        "title": "Stable adult with preserved renal function",
        "scenario": "Adult inpatient receiving vancomycin with stable serum creatinine and routine monitoring needs.",
        "teaching_points": [
            "basic AUC workflow",
            "interpreting routine dosing outputs",
            "transparent explanation of assumptions"
        ]
    },
    {
        "case_id": "CASE-002",
        "title": "Renal function instability",
        "scenario": "Adult inpatient with changing serum creatinine and uncertainty in dose interpretation.",
        "teaching_points": [
            "impact of unstable renal function",
            "higher uncertainty",
            "need for caution in recommendation review"
        ]
    },
    {
        "case_id": "CASE-003",
        "title": "Sparse level data",
        "scenario": "Limited level information available, requiring careful explanation of assumptions and uncertainty.",
        "teaching_points": [
            "sparse data handling",
            "confidence limitations",
            "importance of visible assumptions"
        ]
    },
    {
        "case_id": "CASE-004",
        "title": "AUC versus trough interpretation",
        "scenario": "Case designed to explain why AUC-guided interpretation may differ from trough-based reasoning.",
        "teaching_points": [
            "AUC vs trough",
            "Bayesian explanation",
            "education-focused interpretation"
        ]
    },
    {
        "case_id": "CASE-005",
        "title": "Complex workflow communication case",
        "scenario": "Case focused on explaining dose changes to a broader clinical team in a readable way.",
        "teaching_points": [
            "communication clarity",
            "documentation-ready summary",
            "trust-building output design"
        ]
    }
]

data_out = Path("data/cases/case_library_seed.json")
report_out = Path("reports/case-library/VANCOMYZER_CASE_LIBRARY.md")

data_out.parent.mkdir(parents=True, exist_ok=True)
report_out.parent.mkdir(parents=True, exist_ok=True)

data_out.write_text(json.dumps({
    "generated_at": datetime.utcnow().isoformat() + "Z",
    "cases": cases
}, indent=2), encoding="utf-8")

lines = []
lines.append("# Vancomyzer Case Library")
lines.append("")
lines.append(f"Generated: {datetime.utcnow().isoformat()}Z")
lines.append("")
lines.append("## Purpose")
lines.append("- support website demos")
lines.append("- support educational articles")
lines.append("- support UI testing and transparency review")
lines.append("- support clinician trust through realistic examples")
lines.append("")

for case in cases:
    lines.append(f"## {case['case_id']} — {case['title']}")
    lines.append(f"Scenario: {case['scenario']}")
    lines.append("Teaching points:")
    for tp in case["teaching_points"]:
        lines.append(f"- {tp}")
    lines.append("")

report_out.write_text("\n".join(lines), encoding="utf-8")

print(f"Wrote {data_out}")
print(f"Wrote {report_out}")
