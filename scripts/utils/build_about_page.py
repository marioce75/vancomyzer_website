from pathlib import Path
from datetime import datetime

out = Path("reports/about/VANCOMYZER_ABOUT_PAGE.md")

lines = []
lines.append("# Vancomyzer About Page")
lines.append("")
lines.append(f"Generated: {datetime.utcnow().isoformat()}Z")
lines.append("")

lines.append("## Purpose")
lines.append("Define how Vancomyzer should describe its mission, philosophy, and clinician-first design approach in a credible and specific way.")
lines.append("")

lines.append("## Core mission")
lines.append("Help clinicians review vancomycin dosing workflow with greater clarity, interpretability, and transparency.")
lines.append("")

lines.append("## Product philosophy")
lines.append("- Clinician-readable outputs matter")
lines.append("- Visible assumptions improve trust")
lines.append("- Documentation-ready summaries support workflow")
lines.append("- Explainability should accompany advanced dosing logic")
lines.append("- Caution and limitations should remain visible")
lines.append("")

lines.append("## Recommended about page sections")
lines.append("")
lines.append("### 1. Why Vancomyzer exists")
lines.append("- Vancomycin dosing can be hard to interpret")
lines.append("- Clinicians benefit from clearer workflow support")
lines.append("- Transparency and explainability are central design goals")
lines.append("")

lines.append("### 2. What Vancomyzer is designed to help with")
lines.append("- Review dosing recommendations in a more interpretable way")
lines.append("- Understand assumptions, methods, and outputs")
lines.append("- Support communication and documentation workflows")
lines.append("- Explore sample cases and workflow examples")
lines.append("")

lines.append("### 3. Design principles")
lines.append("- Transparency over black-box presentation")
lines.append("- Interpretability over vague sophistication claims")
lines.append("- Clinical caution over hype")
lines.append("- Workflow usability over unnecessary complexity")
lines.append("")

lines.append("### 4. Who it is for")
lines.append("- ICU pharmacists")
lines.append("- infectious disease pharmacists")
lines.append("- antimicrobial stewardship teams")
lines.append("- clinicians involved in vancomycin dosing review")
lines.append("")

lines.append("### 5. How to explore the product")
lines.append("- Review a sample case")
lines.append("- See how the workflow is explained")
lines.append("- Explore documentation-ready summaries")
lines.append("- Understand the AUC/Bayesian logic")
lines.append("")

lines.append("## Suggested about-page CTA ideas")
lines.append("- Review a sample case")
lines.append("- Explore the workflow")
lines.append("- See how calculations are explained")
lines.append("- Contact us for evaluation")
lines.append("")

lines.append("## Messaging guardrails")
lines.append("- Avoid generic brand language without substance")
lines.append("- Avoid unsupported validation or superiority claims")
lines.append("- Keep mission language concrete and product-linked")
lines.append("- Emphasize clinician support, transparency, and interpretability")
lines.append("")

out.parent.mkdir(parents=True, exist_ok=True)
out.write_text("\n".join(lines), encoding="utf-8")
print(f"Wrote {out}")
