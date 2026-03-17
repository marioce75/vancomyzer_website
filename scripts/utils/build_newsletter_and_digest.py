from pathlib import Path
from datetime import datetime

out = Path("reports/newsletter/VANCOMYZER_NEWSLETTER_AND_DIGEST.md")

lines = []
lines.append("# Vancomyzer Newsletter and Update Digest")
lines.append("")
lines.append(f"Generated: {datetime.utcnow().isoformat()}Z")
lines.append("")

lines.append("## Purpose")
lines.append("Define how Vancomyzer should turn research, educational content, and product updates into a recurring digest that builds trust and repeat engagement.")
lines.append("")

lines.append("## Primary goals")
lines.append("- Keep interested clinicians engaged over time")
lines.append("- Share useful updates without sounding promotional")
lines.append("- Turn research-intelligence findings into concise educational updates")
lines.append("- Reinforce trust through consistent, practical value")
lines.append("")

lines.append("## Recommended digest components")
lines.append("")
lines.append("### 1. Clinical update")
lines.append("- short summary of a relevant vancomycin dosing topic")
lines.append("- could include AUC, Bayesian interpretation, workflow issues, or caution points")
lines.append("")

lines.append("### 2. Practical explainer")
lines.append("- brief educational section")
lines.append("- focused on interpretation, transparency, workflow, or documentation")
lines.append("")

lines.append("### 3. Case spotlight")
lines.append("- one realistic case example")
lines.append("- highlight what the case teaches")
lines.append("- show why assumptions and limitations matter")
lines.append("")

lines.append("### 4. Product/workflow note")
lines.append("- explain a transparency or workflow feature")
lines.append("- keep it educational and grounded")
lines.append("- avoid hype language")
lines.append("")

lines.append("### 5. Suggested CTA")
lines.append("- explore a sample case")
lines.append("- read the explainer")
lines.append("- review a documentation-ready summary")
lines.append("- explore the workflow")
lines.append("")

lines.append("## Digest tone guidance")
lines.append("")
lines.append("- educational")
lines.append("- clinically cautious")
lines.append("- concise")
lines.append("- useful before promotional")
lines.append("")

lines.append("## Messaging guardrails")
lines.append("")
lines.append("- avoid unsupported claims")
lines.append("- avoid aggressive selling")
lines.append("- keep every issue valuable even if the reader never clicks")
lines.append("- align product mentions with actual functionality")
lines.append("")

lines.append("## Suggested digest cadence")
lines.append("")
lines.append("- weekly intelligence digest")
lines.append("- monthly educational roundup")
lines.append("- occasional feature/workflow spotlight when relevant")
lines.append("")

lines.append("## Suggested subject-line patterns")
lines.append("")
lines.append("- Vancomyzer Weekly: AUC and workflow insights")
lines.append("- This week in vancomycin dosing: practical notes")
lines.append("- Case spotlight: interpreting vancomycin dosing more clearly")
lines.append("- Bayesian dosing, workflow, and documentation updates")
lines.append("")

out.parent.mkdir(parents=True, exist_ok=True)
out.write_text("\n".join(lines), encoding="utf-8")
print(f"Wrote {out}")
