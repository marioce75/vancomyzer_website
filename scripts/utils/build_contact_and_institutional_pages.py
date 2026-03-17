from pathlib import Path
from datetime import datetime

out = Path("reports/institutional/VANCOMYZER_CONTACT_AND_INSTITUTIONAL_PAGES.md")

lines = []
lines.append("# Vancomyzer Contact and Institutional Pages")
lines.append("")
lines.append(f"Generated: {datetime.utcnow().isoformat()}Z")
lines.append("")

lines.append("## Purpose")
lines.append("Define how Vancomyzer should present itself to hospitals, stewardship teams, clinical leaders, and serious evaluators.")
lines.append("")

lines.append("## Institutional audience goals")
lines.append("- Understand what Vancomyzer helps with")
lines.append("- Evaluate trust, workflow fit, and interpretability")
lines.append("- Review documentation/export support")
lines.append("- Understand how to begin an evaluation process")
lines.append("")

lines.append("## Recommended institutional page sections")
lines.append("")
lines.append("### 1. Who this is for")
lines.append("- Antimicrobial stewardship teams")
lines.append("- ICU and ID pharmacists")
lines.append("- Hospital clinicians involved in vancomycin dosing")
lines.append("- Clinical leaders evaluating workflow support tools")
lines.append("")

lines.append("### 2. Why teams may care")
lines.append("- More interpretable dosing workflow")
lines.append("- Clearer review of assumptions and outputs")
lines.append("- Documentation-ready summaries")
lines.append("- Trust-oriented and clinician-readable design")
lines.append("")

lines.append("### 3. What evaluators should review")
lines.append("- Example workflow")
lines.append("- Sample cases")
lines.append("- Documentation/export examples")
lines.append("- Transparency and caution features")
lines.append("")

lines.append("### 4. Suggested contact/evaluation CTA")
lines.append("- Request a workflow review")
lines.append("- Review sample cases first")
lines.append("- Explore documentation-ready outputs")
lines.append("- Contact us for evaluation discussion")
lines.append("")

lines.append("## Institutional messaging guardrails")
lines.append("- Avoid unsupported outcome or ROI claims")
lines.append("- Avoid suggesting formal validation beyond actual evidence")
lines.append("- Keep institutional messaging concrete and cautious")
lines.append("- Emphasize workflow support, interpretability, and transparency")
lines.append("")

lines.append("## Contact page guidance")
lines.append("- Keep the page simple and credible")
lines.append("- Explain what kind of inquiry is appropriate")
lines.append("- Offer structured next steps")
lines.append("- Keep demo-first options visible before heavier contact asks")
lines.append("")

lines.append("## Suggested CTA options")
lines.append("- Review a sample case")
lines.append("- See a documentation-ready summary")
lines.append("- Request a workflow evaluation")
lines.append("- Contact us")
lines.append("")

out.parent.mkdir(parents=True, exist_ok=True)
out.write_text("\n".join(lines), encoding="utf-8")
print(f"Wrote {out}")
