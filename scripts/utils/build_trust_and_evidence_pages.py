from pathlib import Path
from datetime import datetime

out = Path("reports/trust-evidence/VANCOMYZER_TRUST_AND_EVIDENCE.md")

lines = []
lines.append("# Vancomyzer Trust and Evidence Pages")
lines.append("")
lines.append(f"Generated: {datetime.utcnow().isoformat()}Z")
lines.append("")

lines.append("## Purpose")
lines.append("Define how Vancomyzer should communicate transparency, caution, interpretability, and evidence-awareness in a clinically credible way.")
lines.append("")

lines.append("## Core trust pillars")
lines.append("- Transparent assumptions")
lines.append("- Interpretable outputs")
lines.append("- Documentation-ready summaries")
lines.append("- Visible limitations and caution notes")
lines.append("- Evidence-aware, clinically cautious messaging")
lines.append("")

lines.append("## Recommended trust/evidence page sections")
lines.append("")
lines.append("### 1. What Vancomyzer is designed to support")
lines.append("- Clearer review of vancomycin dosing workflow")
lines.append("- Explainable Bayesian/AUC-oriented interpretation")
lines.append("- More visible assumptions and outputs")
lines.append("- Documentation and communication support")
lines.append("")

lines.append("### 2. What users should review")
lines.append("- Inputs used")
lines.append("- Method/model used")
lines.append("- Key assumptions")
lines.append("- Limitations and uncertainty")
lines.append("- Safety/caution notes")
lines.append("")

lines.append("### 3. What Vancomyzer should not imply")
lines.append("- No unsupported outcome claims")
lines.append("- No unsupported superiority claims")
lines.append("- No suggestion of formal validation beyond actual evidence")
lines.append("- No black-box certainty language")
lines.append("")

lines.append("### 4. Why transparency matters")
lines.append("- Clinicians need to understand how outputs were generated")
lines.append("- Visible assumptions support trust and review")
lines.append("- Caution notes help prevent overconfidence")
lines.append("- Interpretability is a product differentiator")
lines.append("")

lines.append("### 5. Evidence-aware messaging guidance")
lines.append("- Be specific about what the product helps users review")
lines.append("- Use careful language around Bayesian/AUC support")
lines.append("- Distinguish educational support from clinical claims")
lines.append("- Keep trust language grounded and concrete")
lines.append("")

lines.append("## Suggested CTA ideas")
lines.append("- Review a sample case")
lines.append("- See how the workflow is explained")
lines.append("- Review a documentation-ready summary")
lines.append("- Explore the transparency features")
lines.append("")

lines.append("## Messaging guardrails")
lines.append("- Prefer careful, concrete language")
lines.append("- Avoid implying external validation that has not occurred")
lines.append("- Keep evidence and product claims aligned")
lines.append("- Treat trust as clarity plus caution, not marketing hype")
lines.append("")

out.parent.mkdir(parents=True, exist_ok=True)
out.write_text("\n".join(lines), encoding="utf-8")
print(f"Wrote {out}")
