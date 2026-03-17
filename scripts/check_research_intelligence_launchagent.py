from __future__ import annotations

import hashlib
import json
import subprocess
from pathlib import Path

LABEL = "com.vancomyzer.research-intelligence"
UID = subprocess.check_output(["id", "-u"], text=True).strip()
DOMAIN_TARGET = f"gui/{UID}/{LABEL}"
PLIST_PATH = Path.home() / "Library" / "LaunchAgents" / f"{LABEL}.plist"
RUNTIME_ROOT = Path.home() / "Library" / "Application Support" / "Vancomyzer" / "research-intelligence"
OUT_LOG = Path.home() / "Library" / "Logs" / f"{LABEL}.out.log"
ERR_LOG = Path.home() / "Library" / "Logs" / f"{LABEL}.err.log"
REPO_ROOT = Path("/Volumes/VANCOMYZER/vancomyzer-agents")
REPO_DAEMON = REPO_ROOT / "scripts" / "research_intelligence_daemon.py"
REPO_CONFIG = REPO_ROOT / "configs" / "research_intelligence_schedule.json"
RUNTIME_DAEMON = RUNTIME_ROOT / "scripts" / "research_intelligence_daemon.py"
RUNTIME_CONFIG = RUNTIME_ROOT / "configs" / "research_intelligence_schedule.json"
RUNTIME_PYTHON = REPO_ROOT / ".venv" / "bin" / "python3"


def run_launchctl_print() -> tuple[bool, str]:
    proc = subprocess.run(["launchctl", "print", DOMAIN_TARGET], capture_output=True, text=True)
    return proc.returncode == 0, (proc.stdout or proc.stderr)


def extract_field(text: str, prefix: str) -> str | None:
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith(prefix):
            return stripped.split(prefix, 1)[1].strip()
    return None


def sha256(path: Path) -> str | None:
    return hashlib.sha256(path.read_bytes()).hexdigest() if path.exists() else None


def runtime_match(label: str, repo: Path, runtime: Path) -> str:
    return json.dumps(
        {
            "file": label,
            "repo_exists": repo.exists(),
            "runtime_exists": runtime.exists(),
            "repo_sha256": sha256(repo),
            "runtime_sha256": sha256(runtime),
            "match": sha256(repo) == sha256(runtime),
        }
    )


def runtime_python() -> Path:
    return RUNTIME_PYTHON if RUNTIME_PYTHON.exists() else Path("/usr/bin/python3")


def main() -> None:
    ok, output = run_launchctl_print()

    print("Research Intelligence LaunchAgent Status")
    print(f"- Label: {LABEL}")
    print(f"- Plist path: {PLIST_PATH}")
    print(f"- Runtime bundle path: {RUNTIME_ROOT}")
    print(f"- Stdout log: {OUT_LOG}")
    print(f"- Stderr log: {ERR_LOG}")
    print(f"- Plist exists: {'yes' if PLIST_PATH.exists() else 'no'}")
    print(f"- Runtime bundle exists: {'yes' if RUNTIME_ROOT.exists() else 'no'}")
    print(f"- Stdout log exists: {'yes' if OUT_LOG.exists() else 'no'}")
    print(f"- Stderr log exists: {'yes' if ERR_LOG.exists() else 'no'}")
    print(f"- Runtime vendor exists: {'yes' if (RUNTIME_ROOT / 'vendor' / 'site-packages').exists() else 'no'}")
    print(f"- Repo/runtime daemon match: {runtime_match('daemon', REPO_DAEMON, RUNTIME_DAEMON)}")
    print(f"- Repo/runtime config match: {runtime_match('config', REPO_CONFIG, RUNTIME_CONFIG)}")
    print(f"- Runtime interpreter: {runtime_python()}")

    status_proc = subprocess.run([str(runtime_python()), str(RUNTIME_DAEMON), "firecrawl-status"], capture_output=True, text=True)
    print(f"- Firecrawl runtime status exit: {status_proc.returncode}")
    if status_proc.stdout.strip():
        print("- Firecrawl runtime status:")
        print(status_proc.stdout.strip())
    if status_proc.stderr.strip():
        print("- Firecrawl runtime stderr:")
        print(status_proc.stderr.strip())

    if not ok:
        print("- LaunchAgent loaded: no")
        print("- launchctl status: unavailable")
        print("\nlaunchctl output:")
        print(output.strip())
        return

    state = extract_field(output, "state =") or "unknown"
    last_exit_code = extract_field(output, "last exit code =") or "unknown"
    working_directory = extract_field(output, "working directory =") or "unknown"
    run_interval = extract_field(output, "run interval =") or "unknown"

    print("- LaunchAgent loaded: yes")
    print(f"- launchctl state: {state}")
    print(f"- Last exit code: {last_exit_code}")
    print(f"- Working directory: {working_directory}")
    print(f"- Run interval: {run_interval}")


if __name__ == "__main__":
    main()
