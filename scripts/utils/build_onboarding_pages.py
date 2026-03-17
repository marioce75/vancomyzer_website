from pathlib import Path
from datetime import datetime

out = Path("reports/onboarding/VANCOMYZER_ONBOARDING_FLOW.md")

lines = []
lines.append("# Vancomyzer Onboarding Flow")
lines.append("")
lines.append(f"Generated: {datetime.utcnow().isoformat()}Z")
lines.append("")

lines.append("## Purpose")
lines.append("Guide first-time visitors from initial understanding to trust-building to product exploration.")
lines.append("")

lines.append("## Core onboarding stages")
lines.append("")
lines.append("### 1. What Vancomyzer is")
lines.append("- Explain the product in plain clinical language")
lines.append("- Emphasize transparency, interpretability, and workflow usability")
lines.append("- Avoid hype and unsupported claims")
lines.append("")

lines.append("### 2. Why it matters")
lines.append("- Explain common vancomycin dosing workflow pain points")
lines.append("- Show why visible assumptions and clearer outputs matter")
lines.append("- Connect to Bayesian/AUC interpretation and documentation support")
lines.append("")

lines.append("### 3. See a sample case")
lines.append("- Offer a realistic example such as stable monitoring or renal instability")
lines.append("- Show how the recommendation is explained")
lines.append("- Highlight assumptions, limitations, and caution notes")
lines.append("")

lines.append("### 4. Review a documentation-ready summary")
lines.append("- Show quick summary export")
lines.append("- Show clinical note style export")
lines.append("- Emphasize communication and review benefits")
lines.append("")

lines.append("### 5. Explore the workflow")
lines.append("- Invite the user to see how inputs lead to outputs")
lines.append("- Show trust-building UI elements")
lines.append("- Keep friction low for first-time exploration")
lines.append("")

lines.append("## Recommended onboarding page sections")
lines.append("")
lines.append("1. Hero: what Vancomyzer helps with")
lines.append("2. Why clinicians need clearer dosing workflow")
lines.append("3. Sample case preview")
lines.append("4. Output and export preview")
lines.append("5. CTA block to explore workflow")
lines.append("")

lines.append("## CTA ideas")
lines.append("")
lines.append("- See a sample case")
lines.append("- Review a documentation-ready summary")
lines.append("- Explore the workflow")
lines.append("- Understand the AUC logic")
lines.append("")

lines.append("## Messaging guardrails")
lines.append("")
lines.append("- Keep onboarding educational and trustworthy")
lines.append("- Do not imply outcome superiority without support")
lines.append("- Use clear, clinician-readable language")
lines.append("- Make assumptions and limitations visible when relevant")
lines.append("")

out.parent.mkdir(parents=True, exist_ok=True)
out.write_text("\n".join(lines), encoding="utf-8")
print(f"Wrote {out}")
