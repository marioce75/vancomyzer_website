# Vancomyzer Task Runner Spec — Refined

## Purpose
Define a simple, reliable execution layer for Vancomyzer tasks with clear status handling, traceability, and minimal ambiguity.

## Core goals
- keep task execution traceable
- keep status transitions explicit
- make task ownership visible
- avoid silent scope changes
- keep the runner simple enough to maintain

## Required task states
Use only these states:

1. queued
2. assigned
3. in_progress
4. review_ready
5. blocked
6. done

## State rules

### queued
- task exists
- not yet active

### assigned
- task selected for a tranche or near-term execution
- not yet actively being worked

### in_progress
- task execution has started
- execution note should exist

### review_ready
- output exists
- execution note exists
- task is ready for human or agent review

### blocked
- task cannot proceed due to a specific blocker
- blocker must be written in the execution note

### done
- task accepted as complete
- no further execution needed unless reopened manually

## Recommended transition rules
Allowed normal transitions:

- queued -> assigned
- assigned -> in_progress
- in_progress -> review_ready
- in_progress -> blocked
- review_ready -> done
- review_ready -> in_progress
- blocked -> assigned
- blocked -> in_progress

Avoid:
- queued -> done
- assigned -> done
- queued -> review_ready

## Required execution artifacts
Each task should have:

- task file in tasks/
- state entry in logs/state/task_status.json
- execution note in reports/execution/notes/
- state transition entry in reports/execution/task_runner_log.md

## Required execution-note rule
A task should not be moved to in_progress unless its execution note exists or is created immediately.

## Required blocked-state rule
A blocked task must include:
- explicit blocker description
- what input is missing
- recommended unblock step

## Traceability rules
- every state change must be logged
- assigned roles must remain visible in task state
- execution notes should identify outputs produced
- review_ready should mean actual output exists, not just intent

## Simplicity rules
- keep one state file only
- keep one log file only
- do not add complex orchestration before Phase 1 execution is stable
- prefer manual clarity over premature automation

## Recommended next runner improvements
- validate task existence before state transitions
- warn if execution note is missing when setting in_progress
- warn if output file is missing when setting review_ready
- optionally add a summary command for assigned/in_progress/review_ready tasks

## Guardrails
- do not overengineer the runner
- do not add extra states unless the current ones fail
- do not mark tasks done without review or clear acceptance
- do not let execution notes and state drift apart
