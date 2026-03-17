from pathlib import Path
from datetime import datetime

out = Path("reports/faq/VANCOMYZER_FAQ.md")

faqs = [
    {
        "question": "What is AUC-guided vancomycin dosing?",
        "answer": "AUC-guided vancomycin dosing focuses on estimated drug exposure over time rather than relying only on trough levels. The goal is to support exposure-based interpretation in a more clinically meaningful way.",
    },
    {
        "question": "How is Bayesian dosing different from traditional PK dosing?",
        "answer": "Bayesian dosing uses prior model information together with patient-specific data to support individualized interpretation. Traditional PK approaches can still be useful, but the two methods differ in how they estimate exposure and how they handle sparse information.",
    },
    {
        "question": "Why does transparency matter in a vancomycin dosing tool?",
        "answer": "Transparency matters because clinicians need to understand what inputs, assumptions, and methods influenced a recommendation. Visible reasoning supports trust, review, and safer interpretation.",
    },
    {
        "question": "What should clinicians review before accepting a recommendation?",
        "answer": "Clinicians should review the major inputs used, the method applied, assumptions affecting the result, uncertainty or limitation notes, and any safety-related cautions.",
    },
    {
        "question": "Why might AUC interpretation differ from trough-based reasoning?",
        "answer": "AUC interpretation focuses on total exposure rather than using trough concentration alone as a proxy. Because of that, the clinical interpretation and resulting dosing decisions may differ.",
    },
    {
        "question": "Can documentation-ready summaries improve workflow?",
        "answer": "Documentation-ready summaries can support communication, review, and consistency by making recommendations, assumptions, and cautions easier to copy, share, and understand.",
    },
    {
        "question": "What kinds of cases are useful for learning vancomycin dosing?",
        "answer": "High-value learning cases include stable routine monitoring, renal instability, sparse level data, and comparisons between AUC-guided and trough-based interpretation.",
    },
]

lines = []
lines.append("# Vancomyzer FAQ")
lines.append("")
lines.append(f"Generated: {datetime.utcnow().isoformat()}Z")
lines.append("")
lines.append("## Purpose")
lines.append("Provide clear, clinician-oriented answers to common questions about vancomycin dosing workflow, Bayesian/AUC interpretation, transparency, and documentation support.")
lines.append("")

for item in faqs:
    lines.append(f"## {item['question']}")
    lines.append(item["answer"])
    lines.append("")

lines.append("## Messaging guardrails")
lines.append("- Keep answers educational and clinically cautious")
lines.append("- Avoid unsupported superiority claims")
lines.append("- Keep explanations aligned with actual product behavior")
lines.append("- Prefer clarity and interpretability over hype")

out.parent.mkdir(parents=True, exist_ok=True)
out.write_text("\n".join(lines), encoding="utf-8")
print(f"Wrote {out}")
