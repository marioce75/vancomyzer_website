# Task Execution Note

## Task metadata
- Task file: 103_cursor_prompt_variant.md
- Task title: Create a Cursor-ready variant of the Vancomyzer Phase 1 builder prompt
- Assigned role(s): agents/architect, agents/docs, agents/customer-conversion
- Execution date: 2026-03-13
- Status: review_ready

## Inputs reviewed
- reports/implementation/VANCOMYZER_PHASE1_BUILDER_PROMPT_REFINED.md
- reports/page-specs/VANCOMYZER_HOMEPAGE_IMPLEMENTATION_SPEC_REFINED.md
- reports/page-specs/VANCOMYZER_TRUST_EVIDENCE_IMPLEMENTATION_SPEC_REFINED.md
- reports/page-specs/VANCOMYZER_FAQ_IMPLEMENTATION_SPEC_REFINED.md
- reports/page-specs/VANCOMYZER_ABOUT_IMPLEMENTATION_SPEC_REFINED.md
- reports/page-specs/VANCOMYZER_CONTACT_INSTITUTIONAL_IMPLEMENTATION_SPEC_REFINED.md

## Summary of work performed
- Began adapting the builder prompt into a Cursor-ready implementation prompt.
- Reviewed which details must remain explicit for direct use in Cursor while keeping the prompt compact.
- Focused on preserving page set, asset mapping, sequencing, and claims guardrails.

## Key decisions
- Adapted the refined builder prompt into a Cursor-ready implementation prompt.
- Kept the prompt compact enough for direct pasting while preserving locked page set, asset mapping, sequencing, and guardrails.
- Removed unnecessary planning context.
- Preserved explicit out-of-scope boundaries.

## Output produced
- reports/implementation/VANCOMYZER_PHASE1_CURSOR_PROMPT.md

## Risks / blockers
- none yet

## Recommended next step
- finalize the Cursor-ready prompt and mark task review_ready

## Review notes
- keep prompt concise enough to paste directly
- preserve locked asset mapping
- preserve page order and scope constraints
- avoid unnecessary background context

## Status recommendation
- review_ready
