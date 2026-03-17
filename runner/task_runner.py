from pathlib import Path
from datetime import datetime, timezone
import json
import re

TASKS_DIR = Path("tasks")
STATE_DIR = Path("logs/state")
STATE_FILE = STATE_DIR / "task_status.json"
LOG_FILE = Path("reports/execution/task_runner_log.md")

STATUS_ORDER = ["queued", "assigned", "in_progress", "review_ready", "approved", "blocked", "done"]

def parse_task_file(path: Path):
    text = path.read_text(encoding="utf-8")
    title = ""
    assigned = []
    seen_roles = set()
    expect_role_on_next_line = False

    def add_role(role: str):
        role = role.strip()
        if not re.fullmatch(r"agents/[A-Za-z0-9-]+", role):
            return False
        if role not in seen_roles:
            assigned.append(role)
            seen_roles.add(role)
        return True

    for line in text.splitlines():
        stripped = line.strip()
        if line.startswith("Task:"):
            title = line.replace("Task:", "", 1).strip()

        if expect_role_on_next_line:
            if add_role(stripped):
                expect_role_on_next_line = False
                continue
            if stripped:
                expect_role_on_next_line = False

        if stripped.startswith("- agents/"):
            add_role(stripped.replace("- ", "", 1))
            continue

        if stripped.startswith("Agent responsible:") or stripped.startswith("Assigned role:"):
            _, value = stripped.split(":", 1)
            if not add_role(value):
                expect_role_on_next_line = True
            continue

        if stripped.startswith("Assigned roles:"):
            _, value = stripped.split(":", 1)
            if value.strip():
                for role in re.split(r",\s*", value.strip()):
                    if role:
                        add_role(role)
            else:
                expect_role_on_next_line = True
            continue

    return {
        "task_file": path.name,
        "title": title or path.stem,
        "assigned_roles": assigned,
    }

def load_state():
    if not STATE_FILE.exists():
        return {}
    return json.loads(STATE_FILE.read_text(encoding="utf-8"))

def save_state(state):
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(json.dumps(state, indent=2), encoding="utf-8")

def build_initial_state():
    state = load_state()
    now = datetime.now(timezone.utc).isoformat()
    for path in sorted(TASKS_DIR.glob("*.md")):
        meta = parse_task_file(path)
        if path.name not in state:
            state[path.name] = {
                "title": meta["title"],
                "assigned_roles": meta["assigned_roles"],
                "status": "queued",
                "created_at": now,
                "updated_at": now,
                "notes": "",
            }
        else:
            state[path.name]["title"] = meta["title"]
            state[path.name]["assigned_roles"] = meta["assigned_roles"]
    save_state(state)
    return state

def append_log(message: str):
    LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    if not LOG_FILE.exists():
        LOG_FILE.write_text("# Vancomyzer Task Runner Log\n\n", encoding="utf-8")
    with LOG_FILE.open("a", encoding="utf-8") as f:
        f.write(f"- {datetime.now(timezone.utc).isoformat()} | {message}\n")

def list_tasks(state):
    for name in sorted(state.keys()):
        item = state[name]
        print(f"{name} | {item['status']} | {item['title']}")

def update_status(task_name: str, new_status: str, note: str = ""):
    state = load_state()
    if task_name not in state:
        raise SystemExit(f"Unknown task: {task_name}")
    if new_status not in STATUS_ORDER:
        raise SystemExit(f"Invalid status: {new_status}")
    state[task_name]["status"] = new_status
    state[task_name]["updated_at"] = datetime.now(timezone.utc).isoformat()
    if note:
        state[task_name]["notes"] = note
    save_state(state)
    append_log(f"{task_name} -> {new_status}" + (f" | {note}" if note else ""))

def next_queued(state):
    for name in sorted(state.keys()):
        if state[name]["status"] == "queued":
            return name, state[name]
    return None, None

if __name__ == "__main__":
    import sys

    cmd = sys.argv[1] if len(sys.argv) > 1 else "init"

    if cmd == "init":
        state = build_initial_state()
        append_log("Initialized task runner state")
        print(f"Initialized {len(state)} tasks")
    elif cmd == "list":
        state = load_state()
        list_tasks(state)
    elif cmd == "next":
        state = load_state()
        name, item = next_queued(state)
        if not name:
            print("No queued tasks")
        else:
            print(name)
            print(item["title"])
            print("Assigned roles:", ", ".join(item["assigned_roles"]) if item["assigned_roles"] else "(none)")
    elif cmd == "set":
        if len(sys.argv) < 4:
            raise SystemExit("Usage: python3 runner/task_runner.py set <task_file> <status> [note]")
        task_name = sys.argv[2]
        status = sys.argv[3]
        note = " ".join(sys.argv[4:]) if len(sys.argv) > 4 else ""
        update_status(task_name, status, note)
        print(f"Updated {task_name} -> {status}")
    else:
        raise SystemExit(f"Unknown command: {cmd}")
