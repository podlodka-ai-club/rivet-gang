# Story 1.4: Linear Agent Task Status Reporting

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an operator,
I want `rg run` to report the current Linear task statuses for agent-owned work,
so that I can see what the agent can pick up or is already handling before task automation starts.

## Acceptance Criteria

1. Given Linear authentication and the configured eligibility label are available, when an operator runs the status-only `rg run` mode, then the command queries Linear for issues carrying the configured agent label and reports each task with at least issue key, title, current status, and URL when available.
2. Given matching Linear tasks exist across multiple workflow statuses, when `rg run` reports agent task status, then the output groups or clearly labels tasks by current Linear status and highlights which tasks match the configured eligible statuses for pickup.
3. Given the operator requests task status only, when `rg run` completes, then it does not update Linear issue status, does not add comments, does not create branches, does not modify files, and does not start LLM planning.
4. Given Linear authentication or API access fails, when `rg run` attempts to report agent task status, then the command exits with a non-zero status and reports the failing integration without printing secret values.

## Tasks / Subtasks

- [x] Add an explicit status-only `rg run` command surface while keeping non-status execution blocked. (AC: 1, 2, 3, 4)
  - [x] Add an oclif boolean flag such as `--status-only` in `src/commands/run.ts`; keep the command file responsible only for flag parsing, config loading, and exit behavior.
  - [x] Delegate read-only status reporting to a focused orchestration module under `src/core/` or an equivalently narrow boundary; do not embed Linear API logic in the command file.
  - [x] Preserve the current blocked placeholder for actual task execution paths that belong to later stories.
- [x] Extend the tracker boundary for read-only agent task status queries. (AC: 1, 2, 3, 4)
  - [x] Add a typed, normalized query on the tracker adapter for agent-labeled issues across multiple statuses without leaking Linear payload shapes outside `src/adapters/`.
  - [x] Prefer server-side Linear filtering by the configured eligibility label and stable ordering by update time so the report does not depend on client-side scanning of the whole workspace.
  - [x] Account for Linear pagination explicitly so the status report does not silently truncate agent-owned issues.
  - [x] Keep the status-only path read-only: no calls to `updateStatus` or `addComment`.
- [x] Implement operator-facing status report formatting. (AC: 1, 2, 3)
  - [x] Report each task with identifier, title, current status, and URL when available.
  - [x] Group or clearly label output by current status.
  - [x] Highlight which reported statuses are currently eligible for pickup according to `tracker.eligibleStatuses`.
  - [x] Handle the no-matching-task case with a clear read-only message rather than treating it as an integration failure.
- [x] Add safe failure handling and exit behavior for status-only mode. (AC: 3, 4)
  - [x] Reuse the existing auth/config/env error handling patterns from `rg doctor` and the Linear adapter.
  - [x] Return exit code `1` on Linear auth or API failures and `0` for successful status reports, including empty results.
  - [x] Ensure formatted output and tests prove no secret values are emitted.
- [x] Add focused tests for the status-only run flow. (AC: 1, 2, 3, 4)
  - [x] Add command tests for grouped output, eligible-status highlighting, empty-result reporting, and non-zero exit on auth/API failures.
  - [x] Add tests proving status-only mode performs no side effects beyond the read-only Linear query.
  - [x] Add adapter contract tests for the new read-only status query, including multiple statuses and pagination handling if implemented.
  - [x] Keep tests under the existing Node built-in test runner and `dist`-based import pattern.

## Dev Notes

### Scope Boundaries

This story adds an operator-visible, read-only `rg run` mode before any real task execution exists.

In scope:
- A status-only `rg run` path that reports agent-labeled Linear issues.
- Read-only tracker adapter support for status reporting across multiple statuses.
- Terminal output that makes eligible pickup statuses obvious to the operator.
- Safe failure handling and focused tests for the new mode.

Out of scope:
- Supervisor mode, single-task execution, or any task pickup loop.
- Moving Linear issues to analysis/review/blocked states.
- Adding clarification comments.
- Branch creation, file edits, LLM planning, validation execution, PR/MR creation, or task artifact persistence.
- New dependencies, server components, background workers, caches, or CI changes.

### Existing Implementation To Build On

Build on the existing foundations instead of introducing parallel paths:

- `src/commands/run.ts` currently exposes the command surface and returns a blocked placeholder.
- `src/adapters/tracker-adapter.ts` already defines the adapter boundary for tracker reads and writes.
- `src/adapters/linear-tracker-adapter.ts` already verifies auth, lists eligible issues, normalizes issue payloads, and handles GraphQL error normalization.
- `src/config/config.ts` and `src/config/defaults.ts` already expose `tracker.eligibleStatuses`, `tracker.eligibilityLabel`, and `tracker.authEnv`.
- `src/config/env.ts` already provides the env-var lookup pattern used by `rg doctor`.
- `src/types/task.ts` already defines the normalized `TrackerIssue` shape with identifier, title, state, labels, URL, and updated timestamp.
- `test/commands/doctor.test.mjs` and `test/adapters/linear-tracker-adapter.test.mjs` demonstrate the current `dist`-based test pattern and fake-fetch seams.

### Architecture Compliance

- Keep `src/commands/run.ts` thin. It may parse a boolean flag and map a typed result to stdout and exit code, but it should not own workflow logic or Linear GraphQL details.
- Put any status-report orchestration in a focused module under `src/core/`; do not create a full coordinator yet if this story only needs read-only reporting.
- Keep provider-specific issue filtering, pagination, and GraphQL query construction in `src/adapters/linear-tracker-adapter.ts`.
- Preserve normalized tracker types in `src/types/` and adapter contracts in `src/adapters/`.
- Do not add task artifacts, runtime progress files, or resume state in this story. The status-only mode is read-only operator visibility, not execution.

### Run Mode Guidance

Use a flag-based command surface rather than overloading the default `rg run` path with hidden behavior. oclif boolean flags are the current CLI-framework way to add no-value switches to command classes, which fits a read-only status mode cleanly. A conservative shape is:

```text
rg run --status-only
```

Keep the non-flagged `rg run` path blocked with an explicit message until Story 2.1 introduces supervisor and single-task execution.

### Linear Query Guidance

- The current adapter method `listEligibleIssues` filters by status and label after fetching issues. For this story, prefer a read-only query that uses Linear's GraphQL filtering to constrain results by label name and returns normalized issue metadata directly relevant to the report.
- Include `identifier`, `title`, `url`, `updatedAt`, `state { name }`, and labels in the query result so the command can render the report without additional provider calls.
- Linear paginated issue queries default to the first 50 results. Do not silently truncate agent-owned issues; either paginate until completion or surface a deliberate cap in the output and tests.
- Keep the status report read-only. The story specifically forbids any call path that would mutate issue status or create comments.

### Project Structure Notes

- The repository currently has `src/commands/`, `src/adapters/`, `src/config/`, `src/policy/`, `src/state/`, and `src/types/`, but no `src/core/` directory yet. Creating a narrowly scoped `src/core/run-status.ts` or similarly named module is acceptable and aligns with the architecture summary's expectation that `rg run` logic eventually lives in core.
- Keep file names kebab-case and avoid introducing a generic helper file.

### Testing Requirements

- Continue using `npm test` with Node's built-in test runner; direct test execution still relies on built output under `dist`.
- Add command tests under `test/commands/` for status-only mode behavior and exit codes.
- Extend adapter tests under `test/adapters/` for the new read-only Linear query shape.
- Include a regression test that proves status-only mode does not call `updateStatus`, `addComment`, branch logic, or any file-writing path.
- Include assertions that output does not contain Linear tokens or other secret values.

### Security Requirements

- Credentials must continue to come only from the configured auth env var name.
- Do not read secret files.
- Do not log or print secret values.
- Do not send repository instructions, prompts, or task text to any LLM in this story.
- Do not execute configured validation commands in this story.

### Previous Story Intelligence

Story 1.3 completed the readiness surface and established several patterns that this story should reuse:

- `rg doctor` already accumulates independent checks, formats one-result-per-check output, and returns typed pass/fail exit behavior.
- The Linear adapter already normalizes GraphQL errors, HTTP failures, and JSON failures into `IntegrationError` results.
- `src/policy/vcs-readiness.ts` was added during Story 1.3 review follow-ups and shows the current standard for focused policy modules and regression-test additions.
- The current `rg run` command is intentionally blocked; this story should add only the read-only status path, not early execution logic from Epic 2.
- Recent commits (`15fddd5`, `c4b63f5`, `5e618c1`) show the repo preference for incremental contract changes, fake-fetch adapter tests, and explicit safety-focused regression coverage.

### Latest Technical Context

- oclif's current docs show boolean flags as the standard way to model no-value command switches in `@oclif/core`, which fits a read-only `--status-only` mode for `rg run`. Source: [oclif flags](https://oclif.io/docs/flags)
- Linear's GraphQL API supports filtering paginated issue queries by label relationship, for example `issues(filter: { labels: { name: { eq: "Bug" } } })`, which is a better fit for agent-labeled task reporting than fetching broad issue lists and filtering everything locally. Source: [Linear filtering](https://linear.app/developers/filtering)
- Linear's GraphQL API is paginated with Relay-style `first`/`after`; the first 50 results are returned by default, and issues can be ordered by `updatedAt`. This matters for a status report because silent truncation would hide agent-owned tasks. Source: [Linear pagination](https://linear.app/developers/pagination)
- Linear's GraphQL endpoint remains `https://api.linear.app/graphql`, and issue queries/mutations continue to use the same issue metadata fields and `issueUpdate` mutation shape already used by the existing adapter. Source: [Linear GraphQL getting started](https://linear.app/developers/graphql)

### References

- [Source: /Users/aifedorov/rivet-gang/rg_bmad-output/planning-artifacts/epics.md#Story-1.4]
- [Source: /Users/aifedorov/rivet-gang/rg_bmad-output/implementation-artifacts/1-3-readiness-doctor-for-local-execution.md]
- [Source: /Users/aifedorov/rivet-gang/ARCHITECTURE.md#High-Level-Components]
- [Source: /Users/aifedorov/rivet-gang/ARCHITECTURE.md#Core-Boundaries]
- [Source: /Users/aifedorov/rivet-gang/PRD.md#Command-Structure]
- [Source: /Users/aifedorov/rivet-gang/PRD.md#Functional-Requirements]
- [Source: /Users/aifedorov/rivet-gang/rg_bmad-output/planning-artifacts/architecture.md#Requirements-to-Structure-Mapping]
- [Source: /Users/aifedorov/rivet-gang/rg_bmad-output/project-context.md#Critical-Implementation-Rules]
- [Source: https://oclif.io/docs/flags]
- [Source: https://linear.app/developers/filtering]
- [Source: https://linear.app/developers/pagination]
- [Source: https://linear.app/developers/graphql]

## Dev Agent Record

### Agent Model Used

GPT-5

### Debug Log References

- `npm test` (red phase: missing status-only run command surface and adapter query)
- `npm test`
- `npm run build`
- `npm run typecheck`
- `npm run lint`
- `npm run secretScan`

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Added `rg run --status-only` as a read-only operator path while preserving the blocked placeholder for actual task execution flows.
- Added `src/core/run-status.ts` to keep status-report orchestration out of the command file and reuse existing config/env/error handling patterns.
- Extended the tracker adapter contract and Linear adapter with a paginated, label-filtered agent-issue query ordered by update time.
- Implemented grouped status reporting that highlights configured pickup statuses and handles empty results without treating them as integration failures.
- Addressed code review findings by narrowing status-only config validation to tracker settings, redacting unsafe auth-env names, correcting the label-based status header, and rejecting inconsistent Linear pagination metadata.
- Expanded read-only regression coverage to assert no file tree changes and no unexpected extra network calls during `rg run --status-only`.
- Added command and adapter tests covering grouped output, read-only behavior, empty results, missing auth, API failures, and pagination; full suite now passes with 40 tests.

### File List

- docs/exec-plans/completed/1-4-linear-agent-task-status-reporting.md
- src/adapters/linear-tracker-adapter.ts
- src/adapters/tracker-adapter.ts
- src/cli.ts
- src/commands/run.ts
- src/core/run-status.ts
- test/adapters/linear-tracker-adapter.test.mjs
- test/commands/run.test.mjs
- rg_bmad-output/implementation-artifacts/1-4-linear-agent-task-status-reporting.md
- rg_bmad-output/implementation-artifacts/sprint-status.yaml

### Change Log

- 2026-04-25: Created Story 1.4 with implementation guardrails for read-only `rg run` Linear task status reporting.
- 2026-04-25: Implemented Story 1.4 read-only `rg run --status-only` Linear status reporting, pagination, and test coverage.
- 2026-04-25: Applied code review fixes for tracker-only validation, secret-safe auth env errors, label-accurate status output, pagination guards, and stronger read-only regression coverage.

### Review Findings

- [x] [Review][Patch] Status-only path is gated by unrelated execution config [src/core/run-status.ts:19]
- [x] [Review][Patch] Missing-env failure can echo a secret pasted into `tracker.authEnv` [src/core/run-status.ts:28]
- [x] [Review][Patch] Status report claims label-matched tasks are agent-owned [src/core/run-status.ts:81]
- [x] [Review][Patch] Pagination loop can silently truncate on inconsistent pageInfo [src/adapters/linear-tracker-adapter.ts:108]
- [x] [Review][Patch] Read-only guarantee is under-tested beyond Linear mutation names [test/commands/run.test.mjs:27]
