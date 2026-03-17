Task: Stand up a lightweight continuous external monitoring daemon for research-intelligence

Assigned roles:
- agents/research-intelligence
- agents/architect
- agents/docs
- agents/testing

Scope:
- design a lightweight periodic monitoring runner for external intelligence
- monitor public sources such as Reddit, pharmacy forums, Student Doctor Network, guideline pages, literature sources, and competitor tools
- generate structured periodic reports and propose follow-on tasks
- keep the runner non-aggressive and safe to operate when the TUI session is not active
- do not modify product code as part of the monitoring role

Inputs:
- agents/research-intelligence/ROLE.md
- prompts/research_intelligence_agent.md
- configs/monitoring_sources.yaml
- reports/market-intel/
- reports/competitive-intel/
- tasks/002_research_monitoring_setup.md
- tasks/006_first_weekly_intel_report.md
- tasks/008_monitoring_script_implementation.md

Objectives:
- define a lightweight scheduler/daemon cadence with per-source minimum intervals
- implement a daemon/runner that can be launched independently of the TUI session
- generate report files under reports/market-intel/
- emit task recommendations without directly modifying code
- document operating constraints, source etiquette, and backoff behavior

Required artifact destinations:
- implementation note: docs/research-intelligence-daemon.md
- recurring report directory guidance: reports/market-intel/README.md
- daemon script: scripts/research_intelligence_daemon.py
- schedule config: configs/research_intelligence_schedule.json

Acceptance criteria:
- daemon supports non-aggressive periodic execution
- source polling intervals are explicit and conservative
- report outputs are written to reports/market-intel/
- competitor findings can be routed to reports/competitive-intel/
- proposed follow-on work is emitted as recommendations or task drafts, not code changes
- role remains monitoring-only and never modifies source code
