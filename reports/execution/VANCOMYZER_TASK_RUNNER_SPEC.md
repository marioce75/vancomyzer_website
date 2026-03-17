# Vancomyzer Task Runner Spec

Generated: 2026-03-13T00:05:21.538692Z

## Purpose
Define how the Vancomyzer agent system should execute queued tasks in a controlled, reviewable way.

## Runner objectives
- process tasks in a predictable order
- map tasks to the correct specialist agents
- create traceable execution logs
- avoid silent scope expansion
- support human review before major implementation changes

## Core inputs
- tasks/
- agents/*/ROLE.md
- AGENT_ROUTING_PLAN.md
- WORKFLOW.md

## Core outputs
- reports/execution/task_runner_log.md
- logs/state/task_status.json
- execution notes per task

## Task lifecycle
1. queued
2. assigned
3. in_progress
4. review_ready
5. approved
6. blocked
7. done

## Recommended execution order
- execute foundational planning/refinement tasks before implementation tasks
- prioritize Phase 1 refinement and asset-selection tasks first
- defer broader growth/content tasks until core implementation inputs are stable

## Guardrails
- do not modify multiple strategic layers at once without logging it
- do not skip task-status updates
- do not execute tasks without recording assigned role(s)
- do not auto-approve safety-sensitive outputs
