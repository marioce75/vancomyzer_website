from pathlib import Path
from datetime import datetime

out = Path("reports/seo/VANCOMYZER_SEO_PAGES.md")

pages = [
    {
        "slug": "vancomycin-auc-calculator",
        "title": "Vancomycin AUC Calculator",
        "intent": "Users looking for an AUC-focused dosing tool or explanation.",
        "headline": "Vancomycin AUC calculator with clearer clinical interpretation",
        "subheadline": "Understand AUC-guided vancomycin dosing with transparent logic, workflow-friendly summaries, and explainable outputs.",
        "sections": [
            "What AUC-guided dosing means",
            "Why clinicians use AUC instead of trough-only monitoring",
            "How transparent calculation review builds trust",
            "How Vancomyzer can support interpretation and workflow",
        ],
    },
    {
        "slug": "bayesian-vancomycin-dosing",
        "title": "Bayesian Vancomycin Dosing",
        "intent": "Users seeking Bayesian dosing education or tools.",
        "headline": "Bayesian vancomycin dosing explained more clearly",
        "subheadline": "Learn how Bayesian dosing supports AUC-guided interpretation while keeping assumptions and outputs easier to review.",
        "sections": [
            "What Bayesian dosing is",
            "Bayesian vs traditional PK approaches",
            "Why explainability matters in Bayesian tools",
            "How Vancomyzer can present Bayesian logic more transparently",
        ],
    },
    {
        "slug": "vancomycin-trough-vs-auc",
        "title": "Vancomycin Trough vs AUC",
        "intent": "Users comparing trough-based and AUC-guided dosing.",
        "headline": "Trough versus AUC monitoring in vancomycin dosing",
        "subheadline": "See why AUC-guided interpretation may differ from trough-only reasoning and why workflow clarity matters.",
        "sections": [
            "Why trough monitoring was used historically",
            "Why AUC-guided monitoring matters",
            "Common interpretation pitfalls",
            "How clinicians can review outputs more confidently",
        ],
    },
    {
        "slug": "vancomycin-dosing-examples",
        "title": "Vancomycin Dosing Examples",
        "intent": "Users looking for examples, cases, and educational material.",
        "headline": "Vancomycin dosing examples for real clinical workflow",
        "subheadline": "Review realistic case examples that highlight interpretation, assumptions, caution notes, and workflow decisions.",
        "sections": [
            "Routine monitoring example",
            "Renal instability example",
            "Sparse level data example",
            "AUC vs trough interpretation example",
        ],
    },
]

lines = []
lines.append("# Vancomyzer SEO Pages")
lines.append("")
lines.append(f"Generated: {datetime.utcnow().isoformat()}Z")
lines.append("")

for page in pages:
    lines.append(f"## {page['title']}")
    lines.append(f"Slug: /{page['slug']}")
    lines.append(f"Search intent: {page['intent']}")
    lines.append("")
    lines.append(f"### Headline")
    lines.append(page["headline"])
    lines.append("")
    lines.append("### Subheadline")
    lines.append(page["subheadline"])
    lines.append("")
    lines.append("### Suggested sections")
    for s in page["sections"]:
        lines.append(f"- {s}")
    lines.append("")
    lines.append("### CTA ideas")
    lines.append("- Explore the workflow")
    lines.append("- Review a sample case")
    lines.append("- See how calculations are explained")
    lines.append("- Understand the AUC logic")
    lines.append("")
    lines.append("### Guardrails")
    lines.append("- Keep claims educational and evidence-aware")
    lines.append("- Avoid unsupported superiority claims")
    lines.append("- Align copy with actual product behavior")
    lines.append("")

out.parent.mkdir(parents=True, exist_ok=True)
out.write_text("\n".join(lines), encoding="utf-8")
print(f"Wrote {out}")
