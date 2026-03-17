from pathlib import Path
from datetime import datetime

out = Path("reports/execution/VANCOMYZER_TASK_RUNNER_SPEC.md")

lines = []
lines.append("# Vancomyzer Task Runner Spec")
lines.append("")
lines.append(f"Generated: {datetime.utcnow().isoformat()}Z")
lines.append("")

lines.append("## Purpose")
lines.append("Define how the Vancomyzer agent system should execute queued tasks in a controlled, reviewable way.")
lines.append("")

lines.append("## Runner objectives")
lines.append("- process tasks in a predictable order")
lines.append("- map tasks to the correct specialist agents")
lines.append("- create traceable execution logs")
lines.append("- avoid silent scope expansion")
lines.append("- support human review before major implementation changes")
lines.append("")

lines.append("## Core inputs")
lines.append("- tasks/")
lines.append("- agents/*/ROLE.md")
lines.append("- AGENT_ROUTING_PLAN.md")
lines.append("- WORKFLOW.md")
lines.append("")

lines.append("## Core outputs")
lines.append("- reports/execution/task_runner_log.md")
lines.append("- logs/state/task_status.json")
lines.append("- execution notes per task")
lines.append("")

lines.append("## Task lifecycle")
lines.append("1. queued")
lines.append("2. assigned")
lines.append("3. in_progress")
lines.append("4. review_ready")
lines.append("5. approved")
lines.append("6. blocked")
lines.append("7. done")
lines.append("")

lines.append("## Recommended execution order")
lines.append("- execute foundational planning/refinement tasks before implementation tasks")
lines.append("- prioritize Phase 1 refinement and asset-selection tasks first")
lines.append("- defer broader growth/content tasks until core implementation inputs are stable")
lines.append("")

lines.append("## Guardrails")
lines.append("- do not modify multiple strategic layers at once without logging it")
lines.append("- do not skip task-status updates")
lines.append("- do not execute tasks without recording assigned role(s)")
lines.append("- do not auto-approve safety-sensitive outputs")
lines.append("")

out.parent.mkdir(parents=True, exist_ok=True)
out.write_text('\n'.join(lines), encoding='utf-8')
print(f"Wrote {out}")
