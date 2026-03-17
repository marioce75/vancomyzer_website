from pathlib import Path
from datetime import datetime

out = Path("reports/pricing/VANCOMYZER_PRICING_AND_CONVERSION.md")

lines = []
lines.append("# Vancomyzer Pricing and Conversion Pages")
lines.append("")
lines.append(f"Generated: {datetime.utcnow().isoformat()}Z")
lines.append("")

lines.append("## Purpose")
lines.append("Define how Vancomyzer should present value, trust, and conversion paths for clinicians and institutions.")
lines.append("")

lines.append("## Conversion goals")
lines.append("- Help visitors understand what Vancomyzer offers")
lines.append("- Reduce uncertainty before product exploration")
lines.append("- Emphasize workflow value, transparency, and interpretability")
lines.append("- Create low-friction next steps")
lines.append("")

lines.append("## Audience segments")
lines.append("")
lines.append("### Individual clinician")
lines.append("- Wants quick understanding")
lines.append("- Wants trust and clarity")
lines.append("- May want sample cases and exports before trying")
lines.append("")

lines.append("### Team / hospital / stewardship audience")
lines.append("- Wants workflow consistency")
lines.append("- Wants clearer review and communication")
lines.append("- Wants documentation-ready outputs and trust-oriented design")
lines.append("")

lines.append("## Recommended pricing/conversion page sections")
lines.append("")
lines.append("### 1. Value summary")
lines.append("- Transparent dosing workflow")
lines.append("- Explainable Bayesian/AUC interpretation")
lines.append("- Documentation-ready summaries")
lines.append("- Clinician-readable outputs")
lines.append("")

lines.append("### 2. Why teams may care")
lines.append("- Workflow clarity")
lines.append("- Easier review and communication")
lines.append("- Visible assumptions and limitations")
lines.append("- Better interpretability of outputs")
lines.append("")

lines.append("### 3. Demo-first conversion path")
lines.append("- Review a sample case")
lines.append("- Explore a documentation-ready summary")
lines.append("- See how calculations are explained")
lines.append("- Then invite product exploration")
lines.append("")

lines.append("### 4. Trust and caution section")
lines.append("- Clear messaging guardrails")
lines.append("- No unsupported superiority claims")
lines.append("- Emphasis on interpretation and workflow support")
lines.append("")

lines.append("## CTA ideas")
lines.append("- Review a sample case")
lines.append("- Explore the workflow")
lines.append("- See a documentation-ready summary")
lines.append("- Contact us for workflow evaluation")
lines.append("")

lines.append("## Messaging guardrails")
lines.append("- Avoid unsupported ROI or clinical outcome claims")
lines.append("- Avoid vague precision claims without explanation")
lines.append("- Emphasize transparency, trust, and workflow usability")
lines.append("- Align every claim with actual product behavior")
lines.append("")

lines.append("## Positioning guidance")
lines.append("- Lead with clarity and interpretability")
lines.append("- Use educational conversion before direct selling")
lines.append("- Make trust-building assets visible before strong CTAs")
lines.append("- Keep institutional messaging grounded and cautious")
lines.append("")

out.parent.mkdir(parents=True, exist_ok=True)
out.write_text("\n".join(lines), encoding="utf-8")
print(f"Wrote {out}")
