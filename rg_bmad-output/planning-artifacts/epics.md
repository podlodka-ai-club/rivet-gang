---
stepsCompleted:
  - 'step-01-validate-prerequisites'
  - 'step-02-design-epics'
inputDocuments:
  - '/Users/aifedorov/rivet-gang/PRD.md'
  - '/Users/aifedorov/rivet-gang/ARCHITECTURE.md'
---

# rivet-gang - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for rivet-gang, decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

FR-001: Operators can initialize a project workspace by running `agent init`, which creates the runtime folders, configuration template, and instruction template required to start a project.

FR-002: Operators can verify execution readiness by running `agent doctor`, which checks repository access, integrations, authentication, and required local commands and reports pass or fail for each check.

FR-003: Operators can run `agent run` in supervisor mode for sequential task processing or in single-task mode for one specified task.

FR-004: Supervisor mode processes at most one eligible task at a time and does not start concurrent workers.

FR-005: The agent selects only tasks whose tracker status and eligibility label match the configured automation rules.

FR-006: The agent reads project instructions from `AGENTS.md` before planning or changing code.

FR-007: Operators can create or reuse a deterministic task-specific branch named `<branch_prefix>/<task-id>-<slug>` for each task so repeated runs do not create duplicate branches.

FR-008: When acceptance criteria, scope, or expected behavior are unclear, the agent posts 1-3 concrete clarification questions in one task comment and returns the task to `To Do`.

FR-009: Operators can validate every implementation attempt because the agent runs the configured `test`, `lint`, and `build/typecheck` commands and records pass or fail for each command in task artifacts.

FR-010: Reviewers and operators can confirm secret-scan completion before PR/MR creation because the agent runs the configured secret-scan command and records the result in task artifacts.

FR-011: The agent retries failed validation checks up to the configured repair-attempt limit, then stops automatic repair and reports the unresolved result.

FR-012: The agent creates a draft PR/MR when required validation is incomplete or when unresolved failures remain after the repair-attempt limit.

FR-013: Reviewers and operators can inspect a self-review artifact for every PR/MR candidate that records diff-vs-plan mismatches, forbidden-path scan results, test gaps, declared risks, and reviewer focus.

FR-014: Operators can restart an interrupted run without duplicate side effects because the agent persists state, logs, task-to-branch mapping, and task-to-PR/MR mapping before resume.

FR-015: The agent avoids duplicate branches, clarification comments, and open PRs/MRs for the same task branch.

FR-016: The agent accepts commands only from the configured allowlist and never executes task text as shell input.

FR-017: The agent does not read secret files unless explicitly configured, and it never sends secret values to the LLM or logs.

FR-018: A kill switch stops new task pickup and automatic resume until a human re-enables execution.

FR-019: Reviewers and operators can determine task context, decision result, files changed, commands run, validation outcome, retry history, branch, PR/MR link, and last error by reading the task artifacts alone, without reading raw provider logs.

### NonFunctional Requirements

NFR-001: For the pilot repository, median time from eligible task pickup to PR/MR creation shall be at most 30 minutes across tested runs.

NFR-002: For the pilot repository, average per-task execution cost shall remain within the configured project budget as measured from recorded token usage and cost artifacts.

NFR-003: The system shall create zero secret-leakage events in tested runs, verified by secret-scan results and inspection of generated logs and artifacts.

NFR-004: The system shall resume interrupted runs without creating duplicate branches, clarification comments, or PRs/MRs in 100 percent of restart-resume test scenarios.

NFR-005: For every completed or blocked run, required artifacts shall include `research.md`, `plan.md`, `progress.json`, `implementation.log`, `test.md`, and `self-review.md`, as measured by checking the task folder for all listed files at run end.

NFR-006: The system shall record current stage, stage transition timestamps, decision result, repair-attempt count, branch, PR/MR link if present, total execution time, and last error for every run in `progress.json` or an equivalent machine-readable state file, as measured by artifact schema validation.

NFR-007: The system shall keep unrelated-file changes below 20 percent of tested runs on the pilot repository, as measured by reviewer diff inspection and self-review classification of changed files in pilot runs.

NFR-008: At least 50 percent of failed-check tasks shall converge within the configured repair-attempt limit during pilot evaluation, as measured from repair outcomes recorded in `progress.json` and `test.md`.

### Additional Requirements

- The full architecture record specifies `oclif` as the CLI starter; implementation should establish the TypeScript, Node.js, and `oclif` CLI foundation directly.
- The system must remain a local-first, single-process TypeScript CLI with filesystem-backed state under `.ai-agent/`.
- CLI commands must stay thin: parse CLI input, load config, call orchestration services, and map workflow status to exit behavior.
- Workflow logic must live in `core`, including orchestration, decision gate behavior, clarification logic, branch management, repair loop, resume logic, and self-review.
- Provider-specific interactions must live behind adapters for tracker, VCS, LLM, validation, and secret scanning.
- Policy modules must own scope, forbidden-path, command-allowlist, and risk checks, returning typed results without broad side effects.
- State modules must own path conventions, checkpoint writes, artifact persistence, lock management, and deterministic artifact names.
- Runtime data must use `.ai-agent/config.yaml`, `.ai-agent/state/`, `.ai-agent/tasks/`, `.ai-agent/logs/`, and `.ai-agent/locks/`.
- Shared cross-machine coordination must use repo-tracked documents under `docs/exec-plans/active/` and `docs/exec-plans/completed/`, not another machine's `.ai-agent/` directory.
- Cross-machine handoff must happen through repo-tracked execution plans, branch state, PRs/MRs, and review comments.
- Workflow results must use discriminated unions with fixed statuses: `proceed`, `blocked`, `needsClarification`, `refuseUnsafe`, and `refuseTooLarge`.
- Internal TypeScript models must use `camelCase`; JSON state keys must use `camelCase`; types, interfaces, and classes must use `PascalCase`; timestamps must use ISO 8601.
- Persistence must write checkpoints before duplicate-risk side effects, keep JSON and Markdown responsibilities separate, and prefer atomic writes where practical.
- Credentials must come from explicitly configured environment variables.
- Arbitrary secret files must not be read; secret values must not be logged or sent to the LLM.
- Allowlist checks and forbidden-path checks must run before code edits and before PR/MR creation.
- Tests must be grouped by architectural boundary, with adapter contract tests and fixtures under `test/fixtures/`.
- Dependencies should prefer Node built-ins first and add external dependencies only when required by the PRD, replacing substantial custom code, and preserving architectural boundaries.
- Implementation order should proceed through CLI skeleton, config/env loading, state/artifact store, policy layer, adapter interfaces, coordinator and decision gate, validation runner, then tracker and PR/MR integration.
- MVP must defer public HTTP APIs, server deployment, database-backed state, cache infrastructure, event bus, microservices, concurrent workers, remote client/server split, external telemetry stack, container-first runtime, shared lock services, remote checkpoint stores, distributed queues, and live multi-agent execution protocols.

### UX Design Requirements

UX-DR1: The CLI must expose a clear command structure for `agent init`, `agent doctor`, and `agent run` so operators can discover and run the main workflows without a web UI.

UX-DR2: `agent doctor` output must be scannable in a terminal, showing pass or fail for repository access, integrations, authentication, and required local commands.

UX-DR3: `agent run` output must communicate the current task, decision outcome, validation status, retry count, branch name, PR/MR link when available, and last error without requiring raw provider logs.

UX-DR4: Clarification questions posted back to the task tracker must be concise, concrete, grouped in a single comment, and limited to 1-3 questions so task owners can respond quickly.

UX-DR5: Generated Markdown artifacts must be readable by operators and reviewers, with enough context to understand task research, implementation plan, validation results, self-review findings, risks, and reviewer focus.

UX-DR6: Machine-readable state files must support scriptable operation by exposing compact decision status, stage, timestamps, retries, branch, PR/MR link, and last error.

UX-DR7: CLI commands must be safe for non-interactive automated environments, producing deterministic artifacts and avoiding prompts that block supervisor or single-task runs.

UX-DR8: Error and blocked-state reporting must identify the failing integration, configuration, repository condition, validation command, or policy rule from task artifacts alone.

UX-DR9: Resume behavior must be understandable to an operator by showing whether the run reused an existing branch, comment, lock, or PR/MR and where it resumed from.

UX-DR10: Review-facing PR/MR context must make validation status, scoped file changes, known gaps, and remaining risks easy to inspect before human review.

### FR Coverage Map

FR-001: Epic 1 - Initialize the project workspace.

FR-002: Epic 1 - Verify execution readiness.

FR-003: Epic 2 - Run supervisor mode or single-task mode.

FR-004: Epic 2 - Enforce sequential supervisor execution.

FR-005: Epic 2 - Select only configured eligible tasks.

FR-006: Epic 1 - Read `AGENTS.md` before planning or code changes.

FR-007: Epic 3 - Create or reuse deterministic task branches.

FR-008: Epic 2 - Ask clarification questions and return unclear tasks to `To Do`.

FR-009: Epic 3 - Run and record validation commands.

FR-010: Epic 3 - Run and record secret-scan results before PR/MR creation.

FR-011: Epic 3 - Retry failed validation within the configured repair-attempt limit.

FR-012: Epic 4 - Create draft PR/MR when validation is incomplete or unresolved.

FR-013: Epic 4 - Produce self-review artifacts for PR/MR candidates.

FR-014: Epic 4 - Resume interrupted runs without duplicate side effects.

FR-015: Epic 4 - Avoid duplicate branches, clarification comments, and open PRs/MRs.

FR-016: Epic 3 - Enforce configured command allowlist.

FR-017: Epic 3 - Protect secret files and secret values.

FR-018: Epic 2 - Stop task pickup and automatic resume through a kill switch.

FR-019: Epic 4 - Expose full run context through artifacts.

## Epic List

### Epic 1: Operator Setup and Readiness

Operators can initialize the project, configure runtime basics, verify local readiness, and ensure repository instructions are loaded before any task execution begins.

**FRs covered:** FR-001, FR-002, FR-006

**Primary member area:** Member 1 - runtime setup, CLI bootstrap, config template, doctor checks, repository instruction loading.

### Epic 2: Task Intake, Decisioning, and Agent Prompts

Operators can run the agent, process only eligible tasks, enforce sequential MVP execution, handle clarification, stop new work with a kill switch, and rely on prompts that guide safe analysis and decision outcomes.

**FRs covered:** FR-003, FR-004, FR-005, FR-008, FR-018

**Primary member area:** Member 2 - task tracker intake, supervisor and single-task run flow, eligibility rules, clarification flow, decision gate prompts, analysis prompts, planning prompts, and blocked/refusal messaging.

### Epic 3: Safe Execution and Validation

The agent can create or reuse task branches, enforce command and secret-safety boundaries, run validation and secret scans, and perform bounded repair attempts.

**FRs covered:** FR-007, FR-009, FR-010, FR-011, FR-016, FR-017

**Primary member area:** Member 3 - branch preparation, policy enforcement, command allowlist, forbidden-path checks, secret handling, validation runner, secret-scan runner, repair-loop safety, and safety review of prompts.

### Epic 4: PR/MR Handoff, Resume, and Review Artifacts

Reviewers and operators get draft or review-ready PRs/MRs, self-review artifacts, duplicate-safe resume behavior, and complete run context from artifacts alone.

**FRs covered:** FR-012, FR-013, FR-014, FR-015, FR-019

**Primary member area:** Member 4 - PR/MR creation, draft fallback, self-review prompt, PR/MR description prompt, reviewer-focus prompt, artifact summarization, idempotent resume behavior, duplicate prevention, and run-context artifacts.

## Epic 1: Operator Setup and Readiness

Operators can initialize the project, configure runtime basics, verify local readiness, and ensure repository instructions are loaded before any task execution begins.

## Epic 2: Task Intake, Decisioning, and Agent Prompts

Operators can run the agent, process only eligible tasks, enforce sequential MVP execution, handle clarification, stop new work with a kill switch, and rely on prompts that guide safe analysis and decision outcomes.

## Epic 3: Safe Execution and Validation

The agent can create or reuse task branches, enforce command and secret-safety boundaries, run validation and secret scans, and perform bounded repair attempts.

## Epic 4: PR/MR Handoff, Resume, and Review Artifacts

Reviewers and operators get draft or review-ready PRs/MRs, self-review artifacts, duplicate-safe resume behavior, and complete run context from artifacts alone.
