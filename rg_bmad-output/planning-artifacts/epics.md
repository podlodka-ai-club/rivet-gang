---
stepsCompleted:
  - 'step-01-validate-prerequisites'
  - 'step-01-requirements-confirmed'
  - 'step-02-design-epics'
  - 'step-02-epics-approved'
  - 'step-03-create-stories'
  - 'step-04-final-validation'
status: 'complete'
completedAt: '2026-04-25'
inputDocuments:
  - '/Users/aifedorov/rivet-gang/PRD.md'
  - '/Users/aifedorov/rivet-gang/ARCHITECTURE.md'
---

# rivet-gang - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for rivet-gang, decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

FR-001: Operators can initialize a project workspace by running `rg init`, which creates the runtime folders, configuration template, and instruction template required to start a project.

FR-002: Operators can verify execution readiness by running `rg doctor`, which checks repository access, integrations, authentication, and required local commands and reports pass or fail for each check.

FR-003: Operators can run `rg run` in supervisor mode for sequential task processing or in single-task mode for one specified task.

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
- The CLI app name must be `rg`; first-class commands use the `rg` binary, including `rg init`, `rg doctor`, and `rg run`.
- The first implementation slice must set up Linear as the MVP task tracker integration for checking eligible issues, updating issue status, and adding task comments.
- Linear task intake must select eligible work from Linear issues carrying the `ai-agent` label.
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

UX-DR1: The CLI must expose a clear `rg` command structure for `rg init`, `rg doctor`, and `rg run` so operators can discover and run the main workflows without a web UI.

UX-DR2: `rg doctor` output must be scannable in a terminal, showing pass or fail for repository access, integrations, authentication, and required local commands.

UX-DR3: `rg run` output must communicate the current task, decision outcome, validation status, retry count, branch name, PR/MR link when available, and last error without requiring raw provider logs.

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

Linear epic: RIV-5

### Story 1.1: Bootstrap CLI and Linear Tracker Integration

As an operator, I want the CLI project foundation and Linear tracker integration configured first so the agent can verify Linear access, inspect eligible issues, update issue statuses, and post comments before any automated task execution is attempted.

**FRs covered:** FR-001, FR-002, FR-005, FR-006, FR-008

**Dependencies:** None. This is the first implementation story.

**Scope:**

- Initialize the TypeScript `oclif` CLI foundation with `rg init`, `rg doctor`, and `rg run` command entrypoints.
- Add configuration fields for the MVP Linear tracker provider, including status names, required Linear auth environment variable names, and default eligibility label `ai-agent`.
- Define a tracker adapter interface in the adapter boundary for issue lookup, eligibility filtering, status updates, and comment creation.
- Implement the initial Linear adapter behind that interface.
- Make `rg doctor` verify Linear configuration and authentication without exposing secret values.
- Ensure repository instructions from `AGENTS.md` are read before planning or task execution.
- Add safe, deterministic comment marker handling for agent-created Linear comments.

**Out of Scope:**

- Git branch creation and PR/MR creation.
- LLM planning or code modification.
- Validation runner and repair loop.
- Multi-tracker support beyond the adapter boundary.

**Acceptance Criteria:**

1. Given a fresh repository, when an operator runs `rg init`, then the CLI creates the expected `.ai-agent/` runtime folders and a configuration template that includes Linear tracker settings.
2. Given missing Linear authentication configuration, when an operator runs `rg doctor`, then the command reports Linear authentication as failed without printing secret values.
3. Given valid Linear authentication configuration, when an operator runs `rg doctor`, then the command verifies Linear access and reports the tracker check as passed.
4. Given configured Linear statuses and the `ai-agent` eligibility label, when the tracker adapter checks issues, then it returns only Linear issues matching the configured automation rules and carrying the `ai-agent` label.
5. Given a target Linear issue and a configured status, when the tracker adapter updates status, then the issue is moved through the adapter interface without provider-specific payloads leaking into core logic.
6. Given a target Linear issue and comment body, when the tracker adapter adds a comment, then it writes one agent-marked comment suitable for later deduplication.
7. Given any Linear API or authentication failure, when the CLI reports the result, then it normalizes the failure into a typed integration error that can be surfaced by `rg doctor` or later workflow code.
8. Given repository instructions exist in `AGENTS.md`, when the CLI prepares for task analysis, then those instructions are loaded before planning or code changes.

**Validation Notes:**

- Add focused tests for Linear adapter normalization using fixtures, without requiring live Linear calls.
- Add command tests for `rg init` and `rg doctor` behavior around missing and present Linear configuration.
- Verify no Linear token or secret value is written to logs, stdout, stderr, artifacts, or test snapshots.

### Story 1.2: Runtime Configuration and Repository Instructions

As an operator,
I want project configuration and repository instructions loaded deterministically,
So that every run uses the same local rules, credentials references, and safety defaults.

**FRs covered:** FR-001, FR-002, FR-006

**Dependencies:** Story 1.1

**Acceptance Criteria:**

**Given** a repository with `AGENTS.md`
**When** the CLI loads runtime configuration
**Then** it reads `AGENTS.md` before any planning or code-change workflow can proceed
**And** it records whether repository instructions were loaded successfully.

**Given** no `.ai-agent/config.yaml` exists
**When** an operator runs `rg init`
**Then** the command creates `.ai-agent/config.yaml` from a template
**And** the template includes tracker, VCS, LLM, validation, secret-scan, branch prefix, status, eligibility label, kill-switch, and limit settings.

**Given** configuration references credentials
**When** config validation runs
**Then** only environment variable names are read from config
**And** secret values are not persisted to JSON, Markdown, logs, stdout, or stderr.

**Given** required runtime directories are missing
**When** an operator runs `rg init`
**Then** the command creates `.ai-agent/state/`, `.ai-agent/tasks/`, `.ai-agent/logs/`, and `.ai-agent/locks/`
**And** the command can be rerun without deleting existing runtime state.

### Story 1.3: Readiness Doctor for Local Execution

As an operator,
I want `rg doctor` to report local execution readiness,
So that integration, repository, and command problems are visible before task automation starts.

**FRs covered:** FR-002

**Dependencies:** Story 1.2

**Acceptance Criteria:**

**Given** a configured repository
**When** an operator runs `rg doctor`
**Then** the command reports pass or fail for repository access, Linear authentication, VCS configuration, LLM configuration, LLM API authentication/connectivity, and configured local commands.

**Given** LLM provider and model settings are configured
**When** `rg doctor` evaluates LLM readiness
**Then** it verifies the configured LLM API can be reached with the configured auth environment variable
**And** it reports provider, model, and pass/fail status without printing secret values.

**Given** one readiness check fails
**When** `rg doctor` completes
**Then** the command exits with a non-zero status
**And** its terminal output identifies the failing check without requiring raw provider logs.

**Given** all readiness checks pass
**When** `rg doctor` completes
**Then** the command exits successfully
**And** the output is scannable in a terminal with one result per check.

**Given** a configured command is not allowlisted
**When** `rg doctor` evaluates configured commands
**Then** it reports the command as unsafe or unavailable
**And** it does not execute task text as shell input.

### Story 1.4: Linear Agent Task Status Reporting

As an operator,
I want `rg run` to report the current Linear task statuses for agent-owned work,
So that I can see what the agent can pick up or is already handling before task automation starts.

**FRs covered:** FR-002, FR-003, FR-005

**Dependencies:** Story 1.3

**Acceptance Criteria:**

**Given** Linear authentication and the configured eligibility label are available
**When** an operator runs the status-only `rg run` mode
**Then** the command queries Linear for issues carrying the configured agent label
**And** reports each task with at least issue key, title, current status, and URL when available.

**Given** matching Linear tasks exist across multiple workflow statuses
**When** `rg run` reports agent task status
**Then** the output groups or clearly labels tasks by current Linear status
**And** highlights which tasks match the configured eligible statuses for pickup.

**Given** the operator requests task status only
**When** `rg run` completes
**Then** it does not update Linear issue status
**And** it does not add comments, create branches, modify files, or start LLM planning.

**Given** Linear authentication or API access fails
**When** `rg run` attempts to report agent task status
**Then** the command exits with a non-zero status
**And** reports the failing integration without printing secret values.

## Epic 2: Task Intake, Decisioning, and Agent Prompts

Operators can run the agent, process only eligible tasks, enforce sequential MVP execution, handle clarification, stop new work with a kill switch, and rely on prompts that guide safe analysis and decision outcomes.

Linear epic: RIV-6

### Story 2.1: Run Modes and Sequential Supervisor

As an operator,
I want `rg run` to support single-task and supervisor modes,
So that I can run one selected Linear issue or let the agent process eligible work sequentially.

**FRs covered:** FR-003, FR-004

**Dependencies:** Epic 1

**Acceptance Criteria:**

**Given** an operator provides a specific task identifier
**When** `rg run` starts in single-task mode
**Then** it attempts to process only that Linear issue
**And** it does not poll for additional work.

**Given** an operator starts supervisor mode
**When** eligible Linear issues exist
**Then** the agent selects at most one issue for processing
**And** it does not start concurrent workers.

**Given** supervisor mode is already processing a task
**When** another eligible Linear issue appears
**Then** the agent leaves the new issue untouched until the current task reaches a terminal or waiting state.

### Story 2.2: Linear Eligible Task Selection

As an operator,
I want the agent to pick only Linear issues that match configured automation rules,
So that unsupported or unapproved work is never processed accidentally.

**FRs covered:** FR-005

**Dependencies:** Story 2.1

**Acceptance Criteria:**

**Given** Linear issues exist with different labels
**When** the agent searches for work
**Then** it considers only issues carrying the configured `ai-agent` eligibility label.

**Given** Linear issues exist with the `ai-agent` label in multiple statuses
**When** the agent searches for work
**Then** it selects only issues in the configured eligible status.

**Given** no Linear issue matches both the configured status and `ai-agent` label
**When** `rg run` executes
**Then** it reports that no eligible task was found
**And** it does not update issue status or add comments.

**Given** an issue is selected
**When** task intake begins
**Then** the selected issue identifier, title, labels, status, and updated timestamp are recorded in machine-readable task state.

### Story 2.3: Analysis State and Decision Gate

As an operator,
I want the agent to analyze a selected issue and produce a typed decision,
So that every task either proceeds safely or stops with a clear reason.

**FRs covered:** FR-003, FR-018

**Dependencies:** Story 2.2

**Acceptance Criteria:**

**Given** a selected Linear issue
**When** analysis starts
**Then** the agent moves the issue to the configured analysis status
**And** creates initial `research.md`, `plan.md`, and `progress.json` artifacts.

**Given** task details are clear and scope is small
**When** the decision gate runs
**Then** it returns `proceed`
**And** the decision is recorded in `progress.json`.

**Given** scope, expected behavior, edge cases, or tests are unclear
**When** the decision gate runs
**Then** it returns `needsClarification`
**And** it includes 1-3 concrete questions.

**Given** task scope exceeds the small-diff rubric
**When** the decision gate runs
**Then** it returns `refuseTooLarge`
**And** no code-editing workflow starts.

**Given** forbidden paths, high-risk areas, secrets, privileged credentials, or disallowed command patterns are required
**When** the decision gate runs
**Then** it returns `refuseUnsafe`
**And** no code-editing workflow starts.

**Given** the kill switch is enabled
**When** `rg run` starts
**Then** the agent stops before new task pickup or automatic resume
**And** reports the kill-switch state.

### Story 2.4: Clarification Comment Flow

As a task owner,
I want unclear Linear issues to receive concise clarification questions,
So that I can unblock the agent without reading raw logs.

**FRs covered:** FR-008

**Dependencies:** Story 2.3

**Acceptance Criteria:**

**Given** the decision gate returns `needsClarification`
**When** the agent comments on the Linear issue
**Then** it posts 1-3 concrete questions in one comment
**And** the comment includes a stable agent marker for deduplication.

**Given** clarification questions were posted
**When** the flow completes
**Then** the Linear issue is returned to the configured `To Do` status
**And** `progress.json` records the clarification round and comment marker.

**Given** the same clarification state is resumed
**When** the agent runs again before the issue is updated
**Then** it does not post a duplicate clarification comment.

**Given** the configured clarification-round limit is exceeded
**When** clarification would be requested again
**Then** the task is moved to the configured blocked status
**And** the reason is recorded in artifacts.

## Epic 3: Safe Execution and Validation

The agent can create or reuse task branches, enforce command and secret-safety boundaries, run validation and secret scans, and perform bounded repair attempts.

Linear epic: RIV-7

### Story 3.1: Deterministic Task Branch Preparation

As an operator,
I want each task to use a deterministic branch,
So that repeated runs do not create duplicate branches and reviewers can connect work to the source issue.

**FRs covered:** FR-007

**Dependencies:** Epic 2

**Acceptance Criteria:**

**Given** a selected Linear issue
**When** branch preparation runs
**Then** the agent derives a branch name using `<branch_prefix>/<task-id>-<slug>`
**And** records the branch mapping before creating or switching branches.

**Given** the task branch already exists
**When** branch preparation runs again
**Then** the agent reuses the existing branch
**And** does not create a duplicate branch.

**Given** branch preparation fails
**When** the failure is recorded
**Then** the workflow returns `blocked`
**And** the Linear issue is not moved to review.

### Story 3.2: Command, Path, and Secret Safety Guards

As a reviewer,
I want the agent to enforce command, path, and secret boundaries before edits,
So that unsafe or unrelated changes are blocked before they reach a PR/MR.

**FRs covered:** FR-016, FR-017

**Dependencies:** Story 3.1

**Acceptance Criteria:**

**Given** a task plan includes commands
**When** policy validation runs
**Then** only configured allowlisted commands can execute
**And** task text is never executed as shell input.

**Given** a planned change touches forbidden paths
**When** policy validation runs
**Then** the workflow returns `refuseUnsafe`
**And** no file edits are applied.

**Given** credentials are required for integrations
**When** the agent loads credentials
**Then** it reads only explicitly configured environment variables
**And** it never reads arbitrary secret files.

**Given** logs or artifacts are written
**When** secret values are present in the environment
**Then** secret values are not written to logs, Markdown artifacts, JSON state, stdout, stderr, or LLM prompts.

### Story 3.3: Validation and Secret Scan Recording

As an operator,
I want validation and secret-scan results recorded for every implementation attempt,
So that reviewers can evaluate the change without reconstructing provider logs.

**FRs covered:** FR-009, FR-010

**Dependencies:** Story 3.2

**Acceptance Criteria:**

**Given** configured `test`, `lint`, and `build/typecheck` commands
**When** validation runs
**Then** the agent executes only allowlisted configured commands
**And** records command name, start time, end time, exit code, and pass/fail result in task artifacts.

**Given** a configured secret-scan command
**When** PR/MR creation is being considered
**Then** the agent runs the secret scan first
**And** records the result in `test.md` or equivalent validation artifacts.

**Given** a validation command fails
**When** results are recorded
**Then** the artifact includes the failed command and compact error context
**And** no secret values are included.

### Story 3.4: Bounded Repair Attempts

As an operator,
I want failed checks to be repaired only within configured limits,
So that automation remains controlled and auditable.

**FRs covered:** FR-011

**Dependencies:** Story 3.3

**Acceptance Criteria:**

**Given** validation fails after an implementation attempt
**When** repair is allowed
**Then** the agent may perform another scoped repair attempt
**And** increments the repair-attempt count in `progress.json`.

**Given** the repair-attempt limit is reached
**When** validation still fails
**Then** automatic repair stops
**And** unresolved failures are recorded for draft PR/MR handling.

**Given** a repair attempt changes files outside the plan
**When** self-review or policy validation detects the mismatch
**Then** the workflow records the mismatch
**And** blocks or downgrades handoff according to policy.

## Epic 4: PR/MR Handoff, Resume, and Review Artifacts

Reviewers and operators get draft or review-ready PRs/MRs, self-review artifacts, duplicate-safe resume behavior, and complete run context from artifacts alone.

Linear epic: RIV-8

### Story 4.1: Complete Task Artifact Store

As a reviewer,
I want every completed or blocked run to leave complete artifacts,
So that I can understand the task, decision, validation, and risks without raw logs.

**FRs covered:** FR-019

**Dependencies:** Epic 3

**Acceptance Criteria:**

**Given** a task reaches a completed or blocked terminal state
**When** artifact validation runs
**Then** the task folder contains `research.md`, `plan.md`, `progress.json`, `implementation.log`, `test.md`, and `self-review.md`.

**Given** `progress.json` is written
**When** an operator reads it
**Then** it includes current stage, stage transition timestamps, decision result, repair-attempt count, branch, PR/MR link if present, total execution time, and last error.

**Given** an integration or validation failure occurs
**When** artifacts are written
**Then** the failing integration, command, repository condition, or policy rule is identifiable from artifacts alone.

### Story 4.2: Self-Review Before Handoff

As a reviewer,
I want a self-review artifact for every PR/MR candidate,
So that known risks, gaps, and scope mismatches are explicit before review.

**FRs covered:** FR-013

**Dependencies:** Story 4.1

**Acceptance Criteria:**

**Given** an implementation is ready for handoff
**When** self-review runs
**Then** it records diff-vs-plan mismatches, forbidden-path scan results, test gaps, declared risks, and reviewer focus.

**Given** self-review finds unrelated file changes
**When** the artifact is written
**Then** it classifies the changed files
**And** identifies whether the changes are within the planned module plus directly related tests or docs.

**Given** required validation is incomplete
**When** self-review completes
**Then** it records the gap
**And** marks the handoff as draft-only.

### Story 4.3: Draft or Review-Ready PR/MR Creation

As a task owner,
I want the agent to create the appropriate PR/MR handoff,
So that reviewers receive either a review-ready change or a draft with explicit failures.

**FRs covered:** FR-012

**Dependencies:** Story 4.2

**Acceptance Criteria:**

**Given** all required validation and secret-scan checks pass
**When** PR/MR creation runs
**Then** the agent creates a review-ready PR/MR
**And** records the PR/MR link in `progress.json`.

**Given** required validation is incomplete or unresolved failures remain after the repair limit
**When** PR/MR creation runs
**Then** the agent creates a draft PR/MR
**And** includes explicit failing or incomplete checks in the PR/MR description.

**Given** PR/MR creation succeeds
**When** the Linear issue is updated
**Then** the issue is moved to the configured review status
**And** the PR/MR link is available from task artifacts.

### Story 4.4: Duplicate-Safe Resume and Handoff Idempotency

As an operator,
I want interrupted runs to resume without duplicate side effects,
So that restarts do not create duplicate comments, branches, or PRs/MRs.

**FRs covered:** FR-014, FR-015

**Dependencies:** Story 4.3

**Acceptance Criteria:**

**Given** a run is interrupted after creating a branch
**When** the agent resumes
**Then** it reuses the existing branch from persisted state
**And** does not create a duplicate branch.

**Given** a clarification comment was already posted
**When** the agent resumes the same clarification state
**Then** it detects the stable comment marker
**And** does not post a duplicate comment.

**Given** an open PR/MR already exists for the task branch
**When** PR/MR handoff resumes
**Then** the agent reuses the existing open PR/MR
**And** does not create a duplicate PR/MR.

**Given** resume state is missing or inconsistent
**When** the agent cannot prove the next side effect is safe
**Then** it returns `blocked`
**And** records the reason in artifacts.
