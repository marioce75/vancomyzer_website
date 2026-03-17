# Vancomyzer Execution Note System

Generated: 2026-03-13T00:08:33.354863Z

## Purpose
Define a standard execution-note format so every task result is reviewable and traceable.

## Required fields
- task metadata
- inputs reviewed
- summary of work performed
- key decisions
- output produced
- risks / blockers
- recommended next step
- review notes
- status recommendation

## Status recommendation rules
- review_ready: work completed and ready for review
- blocked: task cannot proceed without additional input
- done: task completed and accepted

## Guardrails
- every assigned task should produce an execution note
- notes should be concise but specific
- blockers must be explicit
- status changes should match the note content

## File location pattern
- reports/execution/notes/<task_file_stem>_execution_note.md
