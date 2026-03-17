from pathlib import Path
from datetime import datetime

OUT = Path("reports/market-intel/incoming")
OUT.mkdir(parents=True, exist_ok=True)

report = OUT / "normalized_findings_scaffold.md"
report.write_text(
f"""Vancomyzer normalized findings scaffold

Generated: {datetime.utcnow().isoformat()}Z

Sections:
1. New evidence signals
2. New guideline signals
3. Public discussion pain points
4. Product opportunities
5. Marketing opportunities
6. Recommended follow-up
"""
)

print(f"Wrote {report}")
