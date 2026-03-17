#!/bin/zsh
set -euo pipefail
cd /Volumes/VANCOMYZER/vancomyzer-agents
exec /usr/bin/python3 /Volumes/VANCOMYZER/vancomyzer-agents/scripts/research_intelligence_daemon.py once
