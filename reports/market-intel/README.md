# Market Intelligence Reports

This directory holds periodic external-monitoring outputs from the research-intelligence lane.

## What belongs here
- recurring source monitoring reports
- synthesized weekly or ad hoc intelligence summaries
- task recommendations derived from repeated external signals

## What does not belong here
- source code changes
- implementation patches
- unsupported claims treated as fact

## Expected conventions
- keep reports traceable to public sources
- separate evidence, anecdote, speculation, and competitor claims
- prefer repeated patterns over one-off comments
- route competitor-specific outputs to `reports/competitive-intel/` when appropriate
- convert meaningful findings into explicit tasks before implementation work begins

## Related paths
- `reports/market-intel/task-recommendations/`
- `reports/competitive-intel/`
- `configs/research_intelligence_schedule.json`
- `scripts/research_intelligence_daemon.py`
