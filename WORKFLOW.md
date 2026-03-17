Vancomyzer execution workflow

1. Orchestrator receives a task.
2. Orchestrator classifies the task:
   - PK/math
   - backend
   - architecture
   - verification
   - testing
   - documentation
   - regulatory/compliance review
   - research intelligence / external monitoring
3. Orchestrator writes a task file into tasks/.
4. Relevant specialist agent works from its ROLE.md and returns output into reviews/ or outputs/.
5. Orchestrator compares specialist outputs.
6. Safety-sensitive changes require verifier review before acceptance.
7. Public-facing claims, disclaimer changes, licensing/trademark-sensitive materials, and regulatory-readiness artifacts should receive regulatory-compliance review before acceptance or publication.
8. Research-intelligence outputs should be treated as external signal inputs, routed into reports/market-intel/ or reports/competitive-intel/, and converted into concrete follow-on tasks before implementation work begins.
9. Accepted changes are documented in docs/ or references/ as needed.
