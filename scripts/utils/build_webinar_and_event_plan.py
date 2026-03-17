from pathlib import Path
from datetime import datetime

out = Path("reports/events/VANCOMYZER_WEBINAR_AND_EVENT_PLAN.md")

lines = []
lines.append("# Vancomyzer Webinar and Educational Event Plan")
lines.append("")
lines.append(f"Generated: {datetime.utcnow().isoformat()}Z")
lines.append("")

lines.append("## Purpose")
lines.append("Define how Vancomyzer can use webinars and educational events to build trust, deepen engagement, and support clinician education.")
lines.append("")

lines.append("## Primary goals")
lines.append("- turn educational content into live or semi-live engagement")
lines.append("- reinforce trust through useful clinician-facing teaching")
lines.append("- create deeper interaction than static pages alone")
lines.append("- support ongoing audience growth and retention")
lines.append("")

lines.append("## Recommended event types")
lines.append("")
lines.append("### 1. Short educational webinar")
lines.append("- focused topic such as Bayesian dosing, AUC workflow, or transparency in dosing tools")
lines.append("- practical and concise")
lines.append("- designed for trust-building, not hype")
lines.append("")

lines.append("### 2. Case-based review session")
lines.append("- walk through one or two realistic vancomycin dosing cases")
lines.append("- explain assumptions, workflow, and caution points")
lines.append("- support both education and product understanding")
lines.append("")

lines.append("### 3. Workflow demo session")
lines.append("- show how a user moves from inputs to outputs")
lines.append("- highlight documentation-ready summaries and transparent logic")
lines.append("- keep the tone educational")
lines.append("")

lines.append("### 4. FAQ/live Q&A session")
lines.append("- answer common clinician questions")
lines.append("- clarify Bayesian/AUC misunderstandings")
lines.append("- connect attendees to deeper resource-hub content")
lines.append("")

lines.append("## Suggested first webinar topics")
lines.append("")
lines.append("- AUC-guided vancomycin dosing: practical interpretation")
lines.append("- Bayesian vancomycin dosing explained in clinician-readable terms")
lines.append("- Trough vs AUC: what actually changes in interpretation")
lines.append("- Why transparency matters in vancomycin dosing workflow")
lines.append("- Documentation-ready dosing summaries and clinical communication")
lines.append("")

lines.append("## Event CTA ideas")
lines.append("")
lines.append("- Register for the educational session")
lines.append("- Reserve a spot for the case review")
lines.append("- Get the recap and case pack")
lines.append("- Explore the related sample case")
lines.append("")

lines.append("## Messaging guardrails")
lines.append("")
lines.append("- keep events educational and credible")
lines.append("- avoid aggressive selling")
lines.append("- avoid unsupported claims")
lines.append("- align all event descriptions with real product capabilities")
lines.append("")

lines.append("## Repurposing opportunities")
lines.append("")
lines.append("- turn webinars into blog posts")
lines.append("- turn Q&A into FAQ content")
lines.append("- turn case reviews into case pages")
lines.append("- turn event takeaways into digest and social content")
lines.append("")

out.parent.mkdir(parents=True, exist_ok=True)
out.write_text("\n".join(lines), encoding="utf-8")
print(f"Wrote {out}")
