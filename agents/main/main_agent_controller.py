import json
from pathlib import Path
from datetime import datetime, timezone
import subprocess

OUT = Path("reports/execution/main_agent_activity_log.md")

def log(message: str) -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    if not OUT.exists():
        OUT.write_text("# Main Agent Activity Log\n\n", encoding="utf-8")
    with OUT.open("a", encoding="utf-8") as f:
        f.write(f"- {datetime.now(timezone.utc).isoformat()} | {message}\n")

def run_cmd(cmd):
    result = subprocess.run(cmd, capture_output=True, text=True)
    output = result.stdout.strip() if result.stdout else result.stderr.strip()
    return output or "No output."

def next_task_summary() -> str:
    return run_cmd(["python3", "runner/task_runner.py", "next"])

def queue_summary() -> str:
    q = Path("reports/execution/VANCOMYZER_PHASE1_EXECUTION_QUEUE.md")
    if not q.exists():
        return "Phase 1 execution queue file not found."
    text = q.read_text(encoding="utf-8")
    return text[:3500]

def status_summary() -> str:
    state_file = Path("logs/state/task_status.json")
    if not state_file.exists():
        return "Task state file not found."
    state = json.loads(state_file.read_text(encoding="utf-8"))
    rows = []
    for name, item in sorted(state.items()):
        if item.get("status") in {"assigned", "in_progress", "review_ready"}:
            rows.append(f"{name} | {item.get('status')} | {item.get('title', '')}")
    return "\n".join(rows[:40]) if rows else "No assigned, in_progress, or review_ready tasks."

def website_status_summary() -> str:
    p = Path("reports/status/VANCOMYZER_PROJECT_STATUS.md")
    if not p.exists():
        return "Project status file not found."
    text = p.read_text(encoding="utf-8")
    return text[:3500]

def deploy_status_summary() -> str:
    p = Path("reports/status/VANCOMYZER_PROJECT_STATUS.md")
    if not p.exists():
        return "Deploy status file not found."
    text = p.read_text(encoding="utf-8").splitlines()
    deploy_lines = []
    keep = False
    for line in text:
        if line.strip() == "## Website build status":
            keep = True
            deploy_lines.append(line)
            continue
        if keep and line.startswith("## "):
            break
        if keep:
            deploy_lines.append(line)
    return "\n".join(deploy_lines).strip() or "No deploy status available."

def run_next_task() -> str:
    state_file = Path("logs/state/task_status.json")
    if not state_file.exists():
        return "Task state file not found."

    state = json.loads(state_file.read_text(encoding="utf-8"))
    next_name = None
    next_item = None

    for name in sorted(state.keys()):
        if state[name].get("status") == "queued":
            next_name = name
            next_item = state[name]
            break

    if not next_name:
        return "No queued task found."

    result = run_cmd([
        "python3", "runner/task_runner.py", "set",
        next_name, "in_progress", "Started from Telegram /run_next"
    ])

    title = next_item.get("title", "")
    roles = ", ".join(next_item.get("assigned_roles", [])) or "(none)"

    return (
        f"Started next task:\n\n"
        f"Task: {next_name}\n"
        f"Title: {title}\n"
        f"Roles: {roles}\n\n"
        f"Runner output:\n{result}"
    )

def handle_main_command(message: str) -> str:
    msg = message.strip()
    log(f"Received main command: {msg}")

    low = msg.lower()

    if low in {"status", "agent status", "agents"}:
        return "Main agent status snapshot:\n\n" + status_summary()

    if low in {"next", "next task"}:
        return "Next queued task:\n\n" + next_task_summary()

    if low in {"queue", "execution queue"}:
        return "Phase 1 execution queue:\n\n" + queue_summary()

    if low in {"website", "website status"}:
        return "Website/project status:\n\n" + website_status_summary()

    if low in {"deploy", "deploy status"}:
        return "Deployment status:\n\n" + deploy_status_summary()

    if low in {"run_next", "run next", "start next"}:
        return run_next_task()

    return (
        "Main agent received your message.\n\n"
        f"Message: {msg}\n\n"
        "Supported initial commands:\n"
        "- status\n"
        "- next\n"
        "- queue\n"
        "- website\n"
        "- deploy\n"
        "- run_next\n"
    )

if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Usage: python3 agents/main/main_agent_controller.py '<message>'")
        raise SystemExit(1)
    message = " ".join(sys.argv[1:])
    print(handle_main_command(message))
