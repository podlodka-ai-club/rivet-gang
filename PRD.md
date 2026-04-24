---
workflowType: 'prd'
workflow: 'edit'
date: '2026-04-23'
classification:
  domain: 'general'
  projectType: 'cli_tool'
  complexity: 'moderate'
inputDocuments:
  - '/Users/aifedorov/rivet-gang/PRD.validation-report.md'
stepsCompleted:
  - 'step-e-01-discovery'
  - 'step-e-02-review'
  - 'step-e-03-edit'
lastEdited: '2026-04-23'
editHistory:
  - date: '2026-04-23'
    changes: 'Added BMAD frontmatter, restored BMAD core sections, added User Journeys, added CLI project-type requirements, and added measurable non-functional requirements.'
---

# PRD: AI Task-to-PR Agent MVP

## Executive Summary

Build a CLI agent that takes a small approved engineering task from a task tracker, analyzes it, asks clarification questions when acceptance criteria are incomplete, implements a minimal code change on a task-specific branch, runs validation, and creates a draft or review-ready PR/MR.

Target users:
- engineering managers or task owners who want low-risk backlog items moved to review faster
- operators who run or supervise the agent on a single repository
- reviewers who need a reviewable PR/MR with enough context to approve or reject without reconstructing the run from raw logs

First mandatory human checkpoint: PR/MR review.

This MVP is not an autonomous software engineer. It is a constrained delivery pipeline for small approved tasks.

## Success Criteria

- all 5 core use cases work in demo
- at least 10 internal tasks are tested on the pilot repository
- at least 6 of 10 tested tasks produce a reviewable PR/MR
- at least 8 of 10 tested tasks report validation status correctly
- less than 20 percent of runs change unrelated files, as confirmed by reviewer diff inspection and self-review checks
- median time from task pickup to PR/MR creation is at most 30 minutes on the pilot repository
- average task cost stays within the configured budget recorded for the project, as monitored through operator-visible run artifacts
- at least 50 percent of failed-check tasks converge within the configured repair-attempt limit
- zero cases of auto-merge, auto-deploy, or secret leakage
- scenarios 1 and 4 in Definition of Done succeed on at least 60 percent of the pilot task set within configured time and cost budgets

## Product Scope

### MVP Goal

Move supported tasks from `To Do` to `In Review` with:

- clear analysis artifacts
- minimal code changes
- validation results
- a reviewable PR/MR

### Product Principles

- Automate until review. No manual plan approval is required for eligible happy-path tasks.
- Safety by default. Enforce forbidden paths, diff limits, file-count limits, and retry limits.
- Minimal diff. Avoid opportunistic refactors, dependency upgrades, and unrelated formatting.
- Transparency. Every task leaves artifacts and logs.

### Operating Constraints

- one repository
- one task tracker
- one VCS or code host
- one LLM provider
- one task at a time
- supervisor mode is sequential only in MVP

### Supported Tasks

- small bug fixes
- edge-case fixes
- small single-module logic or validation changes
- unit test additions or repairs
- small API mapping changes
- text or documentation fixes

### Small Diff Rubric

A task qualifies as a `small diff` only if all of the following are true:

- it touches one module or feature area only
- it changes at most `5` files total
- it changes at most `3` production source files
- it stays within `200` changed lines total
- it stays within `120` changed lines of production code
- it does not touch forbidden paths
- it does not change dependencies, migrations, or CI/CD
- it does not change auth, security, payment, or PII behavior
- it can be validated by the configured checks
- it does not exceed the bounded repair-attempt limit

If any rubric condition fails, the agent must not continue as a normal implementation flow. It must request clarification, create a draft result with explicit risk, or move the task to `Blocked`.

### Out of Scope

- auto-merge
- auto-deploy
- auto-move to `Done`
- multi-repository support
- multi-agent orchestration
- full web UI
- large feature delivery
- architecture redesign
- infra or CI/CD changes
- auth, security, payment, or PII changes

## User Journeys

### Journey 1: Task Owner Gets a Small Task to Review Faster

1. A task owner marks a small approved task as eligible for automation.
2. The agent picks the task, analyzes scope, and decides whether it can proceed safely.
3. If information is missing, the agent posts 1-3 concrete clarification questions and returns the task to `To Do`.
4. If the task is eligible, the agent implements a minimal diff, runs validation, and creates a PR/MR.
5. The task owner sees a reviewable PR/MR with artifacts and validation status, then hands off to human review.

User outcome: small approved work moves to review with less manual coordination.

### Journey 2: Operator Runs the Agent Without Guesswork

1. An operator initializes the runtime, validates integrations, and starts the agent in supervisor or single-task mode.
2. The agent records artifacts, state, branch mapping, retries, and failure reasons in the task workspace.
3. The operator can check task artifacts to confirm run cost stays within the configured budget and that required run records are complete.
4. If the process stops, the operator restarts it and the agent resumes from the last safe state without duplicating comments, branches, or PRs/MRs.
5. If an integration, config, or repo condition blocks progress, the operator can identify the failure from task artifacts alone.

User outcome: the operator can supervise the system reliably without reconstructing runs from provider logs.

### Journey 3: Reviewer Can Evaluate the Change Quickly

1. A reviewer opens the generated PR/MR.
2. The reviewer reads the linked artifacts to understand the task, chosen approach, validation results, and remaining risks.
3. The reviewer verifies that the diff is scoped to the approved task, avoids forbidden-path changes, and does not modify unrelated files outside the planned module plus directly related tests or docs.
4. The reviewer accepts, rejects, or requests follow-up based on explicit evidence instead of inferred context.

User outcome: review time drops because the PR/MR is self-explanatory and validation status is explicit.

## Project-Type Requirements

This product is a `cli_tool`. The PRD must specify command behavior, scriptable operation, configuration, and output artifacts rather than browser or visual-design requirements.

### Command Structure

- the product exposes `agent init`, `agent doctor`, and `agent run` as first-class commands
- `agent run` supports supervisor mode and single-task mode
- supervisor mode is sequential only in MVP and must not start concurrent workers

### Output Formats

- each task run produces human-readable Markdown artifacts and machine-readable state files under the runtime workspace
- the runtime must expose compact validation status, decision outcome, branch name, PR/MR link, retries, and last error without requiring raw provider logs

### Config Schema

Project configuration defines:

- tracker provider, statuses, and eligibility label
- VCS provider, default or target branch, and branch prefix
- LLM provider and model
- auth environment variables for tracker, VCS, and LLM
- commands for `test`, `lint`, `build/typecheck`, and `secret-scan`
- optional forbidden paths
- optional override limits for clarification rounds, repair attempts, and task budget
- kill-switch state

Built-in defaults cover:

- sequential execution with `max_parallel_tasks = 1`
- small-diff limits from the Small Diff Rubric
- default forbidden paths for migrations, infrastructure, deployment, secrets, lockfiles, and high-risk directories
- default high-risk keywords for auth, secrets, destructive data changes, payments, and PII
- allowlisted commands derived from configured commands
- stable task-comment markers

### Scripting Support

- commands are safe to run non-interactively in automated environments
- task text is never executed as shell input
- commands run only from the configured allowlist
- task state is persisted so interrupted runs can resume safely

## Functional Requirements

- FR-001: Operators can initialize a project workspace by running `agent init`, which creates the runtime folders, configuration template, and instruction template required to start a project.
- FR-002: Operators can verify execution readiness by running `agent doctor`, which checks repository access, integrations, authentication, and required local commands and reports pass or fail for each check.
- FR-003: Operators can run `agent run` in supervisor mode for sequential task processing or in single-task mode for one specified task.
- FR-004: Supervisor mode processes at most one eligible task at a time and does not start concurrent workers.
- FR-005: The agent selects only tasks whose tracker status and eligibility label match the configured automation rules.
- FR-006: The agent reads project instructions from `AGENTS.md` before planning or changing code.
- FR-007: Operators can create or reuse a deterministic task-specific branch named `<branch_prefix>/<task-id>-<slug>` for each task so repeated runs do not create duplicate branches.
- FR-008: When acceptance criteria, scope, or expected behavior are unclear, the agent posts 1-3 concrete clarification questions in one task comment and returns the task to `To Do`.
- FR-009: Operators can validate every implementation attempt because the agent runs the configured `test`, `lint`, and `build/typecheck` commands and records pass or fail for each command in task artifacts.
- FR-010: Reviewers and operators can confirm secret-scan completion before PR/MR creation because the agent runs the configured secret-scan command and records the result in task artifacts.
- FR-011: The agent retries failed validation checks up to the configured repair-attempt limit, then stops automatic repair and reports the unresolved result.
- FR-012: The agent creates a draft PR/MR when required validation is incomplete or when unresolved failures remain after the repair-attempt limit.
- FR-013: Reviewers and operators can inspect a self-review artifact for every PR/MR candidate that records diff-vs-plan mismatches, forbidden-path scan results, test gaps, declared risks, and reviewer focus.
- FR-014: Operators can restart an interrupted run without duplicate side effects because the agent persists state, logs, task-to-branch mapping, and task-to-PR/MR mapping before resume.
- FR-015: The agent avoids duplicate branches, clarification comments, and open PRs/MRs for the same task branch.
- FR-016: The agent accepts commands only from the configured allowlist and never executes task text as shell input.
- FR-017: The agent does not read secret files unless explicitly configured, and it never sends secret values to the LLM or logs.
- FR-018: A kill switch stops new task pickup and automatic resume until a human re-enables execution.
- FR-019: Reviewers and operators can determine task context, decision result, files changed, commands run, validation outcome, retry history, branch, PR/MR link, and last error by reading the task artifacts alone, without reading raw provider logs.

## Non-Functional Requirements

- NFR-001: For the pilot repository, median time from eligible task pickup to PR/MR creation shall be at most 30 minutes across tested runs.
- NFR-002: For the pilot repository, average per-task execution cost shall remain within the configured project budget as measured from recorded token usage and cost artifacts.
- NFR-003: The system shall create zero secret-leakage events in tested runs, verified by secret-scan results and inspection of generated logs and artifacts.
- NFR-004: The system shall resume interrupted runs without creating duplicate branches, clarification comments, or PRs/MRs in 100 percent of restart-resume test scenarios.
- NFR-005: For every completed or blocked run, required artifacts shall include `research.md`, `plan.md`, `progress.json`, `implementation.log`, `test.md`, and `self-review.md`, as measured by checking the task folder for all listed files at run end.
- NFR-006: The system shall record current stage, stage transition timestamps, decision result, repair-attempt count, branch, PR/MR link if present, total execution time, and last error for every run in `progress.json` or an equivalent machine-readable state file, as measured by artifact schema validation.
- NFR-007: The system shall keep unrelated-file changes below 20 percent of tested runs on the pilot repository, as measured by reviewer diff inspection and self-review classification of changed files in pilot runs.
- NFR-008: At least 50 percent of failed-check tasks shall converge within the configured repair-attempt limit during pilot evaluation, as measured from repair outcomes recorded in `progress.json` and `test.md`.

## Operational Flow

1. Pick one eligible task in `To Do`.
2. Move it to `In Analysis`.
3. Read task details, repository instructions, and configuration.
4. Write `research.md` and `plan.md`.
5. Run a decision gate with one of these outcomes:
   - `proceed`
   - `needsClarification`
   - `refuseTooLarge`
   - `refuseUnsafe`
   - `blocked`
6. If clarification is needed, add 1-3 concrete questions in one task comment and return the task to `To Do`.
7. Otherwise create a task-specific branch.
8. Implement a minimal diff and update tests when needed.
9. Run configured validation commands.
10. Retry failed checks up to the configured repair-attempt limit.
11. Run self-review and policy checks.
12. Create a draft or review-ready PR/MR.
13. Move the task to `In Review` or `Blocked`.

### Decision Gate Rules

- `proceed`: acceptance criteria are explicit or safely inferable, the task fits the Small Diff Rubric, required integrations work, and no policy rule is violated
- `needsClarification`: expected behavior, scope, edge cases, or test expectations are unclear
- `refuseTooLarge`: estimated scope fails the Small Diff Rubric before implementation
- `refuseUnsafe`: forbidden paths, high-risk areas, secrets, privileged credentials, or disallowed command patterns are required
- `blocked`: tracker, VCS, LLM, git state, configuration, or validation environment is not usable

### Clarification and Resume Rules

- the agent posts 1-3 concrete questions in a single task comment marked with a stable comment marker
- after posting clarification, the task returns to `To Do`
- the supervisor polls sequentially and resumes only when a human updates the task or comments after the last clarification marker
- if `max_clarification_rounds` is exceeded, the task moves to `Blocked`

### Idempotency Rules

- the agent creates one lock file per active task under `.ai-agent/locks/`
- branch names follow `<branch_prefix>/<task-id>-<slug>`
- the agent creates at most one open PR/MR per task branch
- agent comments are deduplicated by stable markers

## Runtime Artifacts

Each task run produces:

- `research.md`
- `plan.md`
- `progress.json`
- `implementation.log`
- `test.md`
- `self-review.md`

Artifact meaning:

- `research.md`: what the agent learned about the task, codebase area, and constraints
- `plan.md`: what the agent intends to change, how it will validate the change, and what stays out of scope
- `progress.json`: current stage, decision, retries, branch, PR/MR link, timestamps, and last error
- `implementation.log`: executed commands, timestamps, exit codes, and errors
- `test.md`: compact validation results
- `self-review.md`: declared risks, gaps, plan mismatches, and reviewer focus

Recommended runtime layout:

```text
.ai-agent/
  config.yaml
  state/
  tasks/
  logs/
  locks/
```

## Use Cases

### Use Case 1: Happy-Path Bug Fix

A ticket has clear acceptance criteria. The agent analyzes it, implements a small fix, updates tests, passes checks, creates a PR/MR, and moves the task to `In Review`.

### Use Case 2: Clarification Required

The task is valid but expected behavior is unclear. The agent adds 1-3 concrete questions as a task comment, returns the task to `To Do`, and retries after the task is updated with answers.

### Use Case 3: Unsafe or Too Large Task

The task touches forbidden areas or is too broad for a safe small MR. The agent does not change code, explains the reason, suggests decomposition or next steps, and moves the task to `Blocked`.

### Use Case 4: Failed Checks and Repair Loop

The first implementation fails tests, lint, or build. The agent retries within limits. If it succeeds, it creates a normal PR/MR. If the result is still useful but unresolved, it creates a draft PR/MR with explicit failures.

### Use Case 5: Resume After Restart

The agent is interrupted mid-task. On restart, it reloads task state, reuses the existing branch or PR/MR if present, avoids duplicates, and resumes from the last safe step.

## Delivery Plan

### Week 1

- Person 1: task tracker integration and status-comment flow
- Person 2: VCS integration, branch handling, PR/MR creation
- Person 3: supervisor loop, task worker, state machine
- Person 4: prompts, research and plan generation, decision gate

Target:

- happy path works on one demo repository
- mid-week sync locks authentication, config shape, eligibility rule, and demo repository

### Week 2

- Person 1: clarification flow and blocked flow
- Person 2: validation runner and repair loop
- Person 3: idempotency, resume, logs, doctor command
- Person 4: self-review, policy guard, forbidden-path checks, demo preparation

Target:

- all 5 use cases demonstrated end-to-end

## Definition of Done

The MVP is done when the team demonstrates the scenarios below, and scenarios 1 and 4 succeed on at least 60 percent of the pilot task set within configured time and cost budgets:

1. happy-path bug fix
2. clarification flow
3. blocked or unsafe refusal
4. failed checks with repair or draft PR/MR
5. restart or resume without duplication
6. operation within configured time and cost budget

## Positioning

Position it as:

"An AI draft-PR agent for small approved engineering tasks."

Do not position it as:

- a full autonomous developer
- a replacement for engineers
- a system that can safely handle any backlog item
