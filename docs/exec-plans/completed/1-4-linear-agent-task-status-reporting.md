---
task: 1-4-linear-agent-task-status-reporting
title: Linear agent task status reporting
branch: epic-1-operator-setup-and-readiness
status: done
owner: codex
updatedAt: 2026-04-25T17:37:25Z
pr: null
sourceDocuments:
  - PRD.md
  - ARCHITECTURE.md
  - rg_bmad-output/planning-artifacts/epics.md
  - rg_bmad-output/implementation-artifacts/1-4-linear-agent-task-status-reporting.md
---

# Execution Plan

## Objective

Implement Story 1.4 by adding a read-only `rg run --status-only` mode that reports agent-labeled Linear issues without performing any task execution side effects.

## Scope In

- `rg run` boolean flag parsing and typed exit behavior
- Read-only status orchestration in a focused `src/core/` module
- Tracker adapter support for agent-labeled issue listing with pagination and ordering
- Command and adapter tests for grouped output, empty results, auth failures, and read-only guarantees

## Scope Out

- Supervisor mode
- Single-task execution
- Linear status updates or comments
- Branch creation, artifact persistence, validation execution, PR/MR creation

## Current Status

Implementation and review follow-up are complete. The status-only `rg run` path is in place, review fixes are applied, and validation is green.

## Implementation Notes

- Keep `src/commands/run.ts` thin.
- Reuse existing Linear adapter error normalization and env/config loading patterns from `rg doctor`.
- Preserve the blocked placeholder for non-status execution paths.
- Avoid new dependencies.

## Open Questions

- None at the moment; current story guidance is specific enough to implement directly.

## Handoff Notes

- Sprint status has been updated to `done` and the review findings are resolved.
- The active branch contains the implementation plus the story and sprint bookkeeping changes.

## Next Actions

1. Start the next ready story.
2. Open a new review pass only if additional changes land on this story.
3. Prepare a commit once the current diff is approved.
