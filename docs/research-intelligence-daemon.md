# Research Intelligence Daemon

## Purpose
Provide a lightweight periodic runner for the research-intelligence lane even when the TUI session is not active.

This daemon is intentionally conservative.
It is designed for bounded periodic public-page monitoring and report generation, not aggressive scraping.

## Runtime architecture
The launchd architecture remains unchanged:
- a user LaunchAgent runs on macOS
- it executes the staged runtime bundle under `~/Library/Application Support/Vancomyzer/research-intelligence/`
- the daemon runs in `once` mode from launchd
- bounded per-source intervals remain enforced inside the daemon

## Staged runtime consistency
The installer now restages the live runtime from current repo files every time it runs.
It refreshes:
- `scripts/research_intelligence_daemon.py`
- `configs/research_intelligence_schedule.json`
- staged Python dependencies under `vendor/site-packages/`

This makes the live launchd runtime reflect the current repo versions of the daemon, config, and related runtime assets.

## Firecrawl runtime support
The live runtime no longer depends on system Python having Firecrawl installed.
The installer now prefers the repo virtualenv interpreter at `.venv/bin/python3` for the LaunchAgent when it exists.
It also stages the repo virtualenv `site-packages` into the runtime bundle at:
- `~/Library/Application Support/Vancomyzer/research-intelligence/vendor/site-packages/`

The daemon prepends that staged vendor path to `sys.path` at startup.
That means Firecrawl can import in the live launchd runtime when:
- `FIRECRAWL_API_KEY` is present, and
- the staged runtime bundle has been refreshed by the installer.

## Operating model
- keep the current `launchd` / daemon architecture
- run in `once` mode from an external scheduler, or in `loop` mode as a lightweight local daemon
- obey per-source minimum intervals
- write recurring output to `reports/market-intel/`
- write task recommendations to `reports/market-intel/task-recommendations/` only when meaningful findings are observed
- prefer Firecrawl-backed scraping for public pages when Firecrawl is configured and available
- fall back to basic lightweight web fetch when Firecrawl is unavailable or fails
- do not modify product source code
- guard against overlapping scheduled runs with a lock file in `logs/state/`

## Bounded behavior
This daemon must remain conservative:
- no aggressive polling
- no always-on tight loop
- no login-gated automation
- no anti-bot bypass behavior
- bounded item counts per run from config

Hourly host scheduling is acceptable because source intervals remain 12h/24h/48h and the daemon no-ops when sources are not due.

## Install / refresh
Refresh the live staged runtime and relaunch the LaunchAgent:

`python3 /Volumes/VANCOMYZER/vancomyzer-agents/scripts/install_research_intelligence_launchagent.py`

The installer now:
- stages current daemon/config from repo
- stages runtime Python dependencies for Firecrawl import
- rewrites the plist
- bootstraps and kickstarts the LaunchAgent

## Verification
Use the status helper:

`python3 /Volumes/VANCOMYZER/vancomyzer-agents/scripts/check_research_intelligence_launchagent.py`

It now reports:
- LaunchAgent load state
- repo/runtime daemon hash match
- repo/runtime config hash match
- presence of staged vendor dependencies
- live runtime Firecrawl status via `firecrawl-status`

## Logs
- `~/Library/Logs/com.vancomyzer.research-intelligence.out.log`
- `~/Library/Logs/com.vancomyzer.research-intelligence.err.log`
