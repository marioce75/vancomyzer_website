from pathlib import Path
from datetime import datetime

out = Path("reports/seo-sections/VANCOMYZER_SEO_LANDING_SECTIONS.md")

pages = [
    {
        "title": "Vancomycin AUC Calculator",
        "slug": "/vancomycin-auc-calculator",
        "hero": "Vancomycin AUC calculator with clearer clinical interpretation",
        "sections": [
            {
                "name": "What this page is for",
                "copy": "Help clinicians understand AUC-guided vancomycin dosing, why it matters, and how a transparent workflow can improve interpretation."
            },
            {
                "name": "Why AUC matters",
                "copy": "Explain why AUC-guided dosing is used, how it differs from trough-only reasoning, and why workflow clarity matters."
            },
            {
                "name": "How Vancomyzer supports interpretation",
                "copy": "Show how recommendations, assumptions, and outputs can be reviewed in a more clinician-readable way."
            },
            {
                "name": "Suggested CTA block",
                "copy": "Invite users to review a sample case, explore the workflow, or see how calculations are explained."
            },
        ],
    },
    {
        "title": "Bayesian Vancomycin Dosing",
        "slug": "/bayesian-vancomycin-dosing",
        "hero": "Bayesian vancomycin dosing explained more clearly",
        "sections": [
            {
                "name": "What Bayesian dosing means",
                "copy": "Explain Bayesian dosing in practical clinical terms, not abstract math-first language."
            },
            {
                "name": "Bayesian vs traditional PK",
                "copy": "Compare the concepts in a clear, non-hyped way, emphasizing interpretation and use context."
            },
            {
                "name": "Why explainability matters",
                "copy": "Show why clinicians benefit from visible assumptions, outputs, and limits rather than black-box recommendations."
            },
            {
                "name": "Suggested CTA block",
                "copy": "Invite users to understand the AUC logic or review a sample case."
            },
        ],
    },
    {
        "title": "Vancomycin Trough vs AUC",
        "slug": "/vancomycin-trough-vs-auc",
        "hero": "Trough versus AUC monitoring in vancomycin dosing",
        "sections": [
            {
                "name": "Historical context",
                "copy": "Explain why trough monitoring was widely used and why AUC-guided approaches became more important."
            },
            {
                "name": "How interpretation changes",
                "copy": "Show how conclusions may differ when using AUC-guided reasoning instead of trough-focused reasoning."
            },
            {
                "name": "Workflow implications",
                "copy": "Describe how clinicians can review outputs, assumptions, and caution notes more effectively."
            },
            {
                "name": "Suggested CTA block",
                "copy": "Invite users to review a comparison case or explore a more transparent workflow."
            },
        ],
    },
    {
        "title": "Vancomycin Dosing Examples",
        "slug": "/vancomycin-dosing-examples",
        "hero": "Vancomycin dosing examples for real clinical workflow",
        "sections": [
            {
                "name": "Case preview grid",
                "copy": "Show a small set of realistic cases such as stable monitoring, renal instability, sparse data, and AUC-vs-trough interpretation."
            },
            {
                "name": "What each case teaches",
                "copy": "Connect each case to interpretation challenges, visible assumptions, and documentation-ready outputs."
            },
            {
                "name": "Why examples build trust",
                "copy": "Show how realistic examples help clinicians understand workflow, limits, and reasoning."
            },
            {
                "name": "Suggested CTA block",
                "copy": "Invite users to review a sample case or see a documentation-ready summary."
            },
        ],
    },
]

lines = []
lines.append("# Vancomyzer SEO Landing Sections")
lines.append("")
lines.append(f"Generated: {datetime.utcnow().isoformat()}Z")
lines.append("")

for page in pages:
    lines.append(f"## {page['title']}")
    lines.append(f"Slug: {page['slug']}")
    lines.append("")
    lines.append("### Hero")
    lines.append(page["hero"])
    lines.append("")
    for section in page["sections"]:
        lines.append(f"### {section['name']}")
        lines.append(section["copy"])
        lines.append("")
    lines.append("### Messaging guardrails")
    lines.append("- Keep claims educational and evidence-aware")
    lines.append("- Avoid unsupported superiority claims")
    lines.append("- Align the page with actual product behavior")
    lines.append("")

out.parent.mkdir(parents=True, exist_ok=True)
out.write_text("\n".join(lines), encoding="utf-8")
print(f"Wrote {out}")
