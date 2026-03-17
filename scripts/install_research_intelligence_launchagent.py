from __future__ import annotations

import hashlib
import shutil
import stat
import subprocess
from pathlib import Path
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parents[1]
TEMPLATE = ROOT / "launchd" / "com.vancomyzer.research-intelligence.plist"
TARGET = Path.home() / "Library" / "LaunchAgents" / "com.vancomyzer.research-intelligence.plist"
RUNTIME_ROOT = Path.home() / "Library" / "Application Support" / "Vancomyzer" / "research-intelligence"
RUNTIME_SCRIPT = RUNTIME_ROOT / "scripts" / "research_intelligence_daemon.py"
RUNTIME_CONFIG = RUNTIME_ROOT / "configs" / "research_intelligence_schedule.json"
RUNTIME_VENDOR = RUNTIME_ROOT / "vendor" / "site-packages"
RUNTIME_PLIST_LABEL = "com.vancomyzer.research-intelligence"
RUNTIME_OUT_LOG = Path.home() / "Library" / "Logs" / "com.vancomyzer.research-intelligence.out.log"
RUNTIME_ERR_LOG = Path.home() / "Library" / "Logs" / "com.vancomyzer.research-intelligence.err.log"
REPO_VENV_PYTHON = ROOT / ".venv" / "bin" / "python3"


def repo_site_packages() -> Path:
    matches = sorted((ROOT / ".venv" / "lib").glob("python*/site-packages"))
    if not matches:
        raise SystemExit("Missing repo virtualenv site-packages under .venv/lib/python*/site-packages")
    return matches[0]


def runtime_python() -> Path:
    return REPO_VENV_PYTHON if REPO_VENV_PYTHON.exists() else Path("/usr/bin/python3")


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def stage_runtime_bundle() -> None:
    (RUNTIME_ROOT / "scripts").mkdir(parents=True, exist_ok=True)
    (RUNTIME_ROOT / "configs").mkdir(parents=True, exist_ok=True)
    (RUNTIME_ROOT / "vendor").mkdir(parents=True, exist_ok=True)

    shutil.copyfile(ROOT / "scripts" / "research_intelligence_daemon.py", RUNTIME_SCRIPT)
    shutil.copyfile(ROOT / "configs" / "research_intelligence_schedule.json", RUNTIME_CONFIG)

    current_mode = RUNTIME_SCRIPT.stat().st_mode
    RUNTIME_SCRIPT.chmod(current_mode | stat.S_IXUSR)

    source_site_packages = repo_site_packages()
    if RUNTIME_VENDOR.exists():
        shutil.rmtree(RUNTIME_VENDOR)
    shutil.copytree(source_site_packages, RUNTIME_VENDOR, dirs_exist_ok=False)


def render_plist() -> str:
    command = f"cd '{RUNTIME_ROOT}' && '{runtime_python()}' '{RUNTIME_SCRIPT}' once"
    command_xml = escape(command)
    return f'''<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>{RUNTIME_PLIST_LABEL}</string>

    <key>ProgramArguments</key>
    <array>
      <string>/bin/zsh</string>
      <string>-lc</string>
      <string>{command_xml}</string>
    </array>

    <key>WorkingDirectory</key>
    <string>{Path.home()}</string>

    <key>StartInterval</key>
    <integer>3600</integer>

    <key>RunAtLoad</key>
    <true/>

    <key>StandardOutPath</key>
    <string>{RUNTIME_OUT_LOG}</string>

    <key>StandardErrorPath</key>
    <string>{RUNTIME_ERR_LOG}</string>
  </dict>
</plist>
'''


def refresh_launchagent() -> None:
    uid = subprocess.check_output(["id", "-u"], text=True).strip()
    subprocess.run(["launchctl", "bootout", f"gui/{uid}", str(TARGET)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    subprocess.run(["launchctl", "bootstrap", f"gui/{uid}", str(TARGET)], check=True)
    subprocess.run(["launchctl", "enable", f"gui/{uid}/{RUNTIME_PLIST_LABEL}"], check=True)
    subprocess.run(["launchctl", "kickstart", "-k", f"gui/{uid}/{RUNTIME_PLIST_LABEL}"], check=True)


def main() -> None:
    if not TEMPLATE.exists():
        raise SystemExit(f"Missing template: {TEMPLATE}")
    TARGET.parent.mkdir(parents=True, exist_ok=True)
    RUNTIME_OUT_LOG.parent.mkdir(parents=True, exist_ok=True)
    stage_runtime_bundle()
    TARGET.write_text(render_plist(), encoding="utf-8")
    refresh_launchagent()
    print(f"Installed LaunchAgent plist to {TARGET}")
    print(f"Staged runtime bundle in {RUNTIME_ROOT}")
    print(f"Daemon sha256: {sha256(ROOT / 'scripts' / 'research_intelligence_daemon.py')} -> {sha256(RUNTIME_SCRIPT)}")
    print(f"Config sha256: {sha256(ROOT / 'configs' / 'research_intelligence_schedule.json')} -> {sha256(RUNTIME_CONFIG)}")
    print(f"LaunchAgent interpreter: {runtime_python()}")
    print("Runtime now stages repo virtualenv site-packages and prefers the repo virtualenv interpreter so Firecrawl can import under launchd when FIRECRAWL_API_KEY is present.")


if __name__ == "__main__":
    main()
