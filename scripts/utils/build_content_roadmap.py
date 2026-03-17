from pathlib import Path
from datetime import datetime

dashboard = Path("reports/market-intel/weekly/COMBINED_INTEL_DASHBOARD.md")
roadmap = Path("reports/roadmap/VANCOMYZER_ACTION_ROADMAP.md")
out = Path("reports/content/VANCOMYZER_CONTENT_ROADMAP.md")

def read(p):
    return p.read_text(encoding="utf-8") if p.exists() else ""

lines = []

lines.append("# Vancomyzer Content Roadmap")
lines.append("")
lines.append(f"Generated: {datetime.utcnow().isoformat()}Z")
lines.append("")

lines.append("## Strategic goals")
lines.append("")
lines.append("- Educate clinicians about vancomycin dosing workflows")
lines.append("- Build trust through transparency and explanation")
lines.append("- Capture SEO around vancomycin dosing problems")
lines.append("- Support product adoption through education")
lines.append("")

lines.append("## Core content pillars")
lines.append("")

lines.append("### 1. Bayesian dosing education")
lines.append("- What Bayesian vancomycin dosing actually means")
lines.append("- Bayesian vs traditional PK dosing")
lines.append("- Why Bayesian dosing can improve AUC targeting")
lines.append("- Common misunderstandings in Bayesian dosing")
lines.append("")

lines.append("### 2. AUC monitoring workflow")
lines.append("- How AUC-guided vancomycin dosing works")
lines.append("- Trough vs AUC monitoring explained")
lines.append("- Implementing AUC monitoring in real workflow")
lines.append("- Common pitfalls when estimating AUC")
lines.append("")

lines.append("### 3. Clinical workflow problems")
lines.append("- Difficult vancomycin dosing scenarios")
lines.append("- Renal function instability and dosing")
lines.append("- Sparse level data and dose interpretation")
lines.append("- Explaining dose changes to clinical teams")
lines.append("")

lines.append("### 4. Transparency in dosing tools")
lines.append("- Why dosing transparency matters")
lines.append("- Risks of black-box dosing tools")
lines.append("- How clinicians should review dosing logic")
lines.append("- Building trust in precision dosing tools")
lines.append("")

lines.append("## High-value SEO topics")
lines.append("")
lines.append("- Bayesian vancomycin dosing calculator")
lines.append("- Vancomycin AUC calculator explained")
lines.append("- How to calculate vancomycin AUC")
lines.append("- Vancomycin dosing examples")
lines.append("- Vancomycin trough vs AUC")
lines.append("")

lines.append("## Suggested content sequence")
lines.append("")
lines.append("1. Educational cornerstone: Bayesian dosing explanation")
lines.append("2. AUC monitoring workflow guide")
lines.append("3. Common dosing pitfalls")
lines.append("4. Transparent dosing tools discussion")
lines.append("5. Case-based dosing examples")
lines.append("")

lines.append("## CTA opportunities")
lines.append("")
lines.append("- Explore the dosing workflow")
lines.append("- Try the Vancomyzer calculator")
lines.append("- Review a sample dosing case")
lines.append("- Understand the calculation logic")
lines.append("")

out.parent.mkdir(parents=True, exist_ok=True)
out.write_text("\n".join(lines), encoding="utf-8")

print(f"Wrote {out}")
