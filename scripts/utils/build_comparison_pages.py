from pathlib import Path
from datetime import datetime

out = Path("reports/comparison-pages/VANCOMYZER_COMPARISON_PAGES.md")

pages = [
    {
        "title": "Vancomyzer vs VancoCalc",
        "slug": "/compare/vancomyzer-vs-vancocalc",
        "hero": "Vancomyzer vs VancoCalc",
        "summary": "A comparison page focused on workflow clarity, transparency, and interpretability.",
        "sections": [
            "Who each tool appears to serve",
            "Transparency and explainability differences",
            "Workflow and usability differences",
            "Educational value and trust signals",
            "When clinicians may care about clearer outputs",
        ],
    },
    {
        "title": "AUC vs Trough Monitoring",
        "slug": "/compare/auc-vs-trough",
        "hero": "AUC vs trough monitoring in vancomycin dosing",
        "summary": "An educational comparison page explaining the difference between AUC-guided and trough-based reasoning.",
        "sections": [
            "Why trough monitoring was historically common",
            "Why AUC-guided monitoring matters",
            "How interpretation differs",
            "Common workflow misunderstandings",
            "How clearer outputs can help clinical review",
        ],
    },
    {
        "title": "Bayesian vs Traditional PK",
        "slug": "/compare/bayesian-vs-traditional-pk",
        "hero": "Bayesian versus traditional PK in vancomycin dosing",
        "summary": "An educational comparison page showing conceptual differences without exaggerated claims.",
        "sections": [
            "What Bayesian dosing means",
            "What traditional PK methods do well",
            "Where interpretation differs",
            "Why explainability matters in both approaches",
            "How clinicians can review assumptions more clearly",
        ],
    },
]

lines = []
lines.append("# Vancomyzer Comparison Pages")
lines.append("")
lines.append(f"Generated: {datetime.utcnow().isoformat()}Z")
lines.append("")

for page in pages:
    lines.append(f"## {page['title']}")
    lines.append(f"Suggested slug: {page['slug']}")
    lines.append("")
    lines.append("### Hero")
    lines.append(page["hero"])
    lines.append("")
    lines.append("### Summary")
    lines.append(page["summary"])
    lines.append("")
    lines.append("### Recommended sections")
    for section in page["sections"]:
        lines.append(f"- {section}")
    lines.append("")
    lines.append("### CTA ideas")
    lines.append("- Explore the workflow")
    lines.append("- Review a sample case")
    lines.append("- See how calculations are explained")
    lines.append("- Understand the logic")
    lines.append("")
    lines.append("### Messaging guardrails")
    lines.append("- Keep comparisons fair and evidence-aware")
    lines.append("- Avoid unsupported superiority claims")
    lines.append("- Do not misrepresent competitor capabilities")
    lines.append("- Keep educational tone even on competitive pages")
    lines.append("")

out.parent.mkdir(parents=True, exist_ok=True)
out.write_text("\n".join(lines), encoding="utf-8")
print(f"Wrote {out}")
