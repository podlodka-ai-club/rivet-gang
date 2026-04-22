# MVP PRD: AI Task-to-PR Agent

## 1. Summary

Build an AI agent that takes a small approved engineering task from a task tracker, analyzes it, asks clarification questions if needed, implements a minimal code change on a task-specific branch, runs validation, and creates a draft or review-ready PR/MR.

First mandatory human checkpoint: PR/MR review.

This MVP is not an autonomous software engineer. It is a constrained delivery pipeline for small tasks.

## 2. Goal

Move supported tasks from `To Do` to `In Review` with:

- clear analysis artifacts
- minimal code changes
- validation results
- a reviewable PR/MR

## 3. Constraints

- one repository
- one task tracker
- one VCS/code host
- one LLM provider
- one task at a time
- supervisor mode is sequential only in MVP; no concurrent workers

## 4. Non-Goals

- auto-merge
- auto-deploy
- auto-move to `Done`
- multi-repo support
- multi-agent orchestration
- full web UI
- large feature delivery
- architecture redesign
- infra / CI/CD changes
- auth / security / payment / PII changes

## 5. Product Principles

- Automate until review. No manual plan approval for eligible tasks.
- Safety by default. Enforce forbidden paths, diff limits, file-count limits, and retry limits.
- Minimal diff. No opportunistic refactors, dependency upgrades, or unrelated formatting.
- Transparency. Every task leaves artifacts and logs.

## 6. Supported Tasks

Supported:

- small bug fixes
- edge-case fixes
- small single-module logic or validation changes
- unit test additions or repairs
- small API mapping changes
- text or documentation fixes

Unsupported:

- large or ambiguous tasks
- multi-module changes
- migrations
- infra / CI/CD work
- dependency upgrades
- production incident work
- security-sensitive areas

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

If any of these conditions fail, the task should not proceed as a normal happy-path implementation. The agent should either:

- request clarification
- create a draft result with explicit risk
- or move the task to `Blocked`

## 7. Core Flow

1. Pick one eligible task in `To Do`.
2. Move it to `In Analysis`.
3. Read task details, repo instructions, and config.
4. Write `research.md` and `plan.md`.
5. Run decision gate:
   - `proceed`
   - `needs_clarification`
   - `refuse_too_large`
   - `refuse_unsafe`
   - `blocked`
6. If clarification is needed, add 1-3 concrete questions as a task comment and return the task to `To Do`.
7. Otherwise create a task-specific branch.
8. Implement a minimal diff and update tests if needed.
9. Run configured `test`, `lint`, and `build/typecheck`.
10. Retry failed checks up to the configured repair limit.
11. Run self-review and policy checks.
12. Create draft or review-ready PR/MR.
13. Move task to `In Review` or `Blocked`.

### Decision Gate Rules

- `proceed`: acceptance criteria are explicit or safely inferable, the task fits the Small Diff Rubric, required integrations work, and no policy rule is violated
- `needs_clarification`: expected behavior, scope, edge cases, or test expectations are unclear
- `refuse_too_large`: estimated scope fails the Small Diff Rubric before implementation
- `refuse_unsafe`: forbidden paths, high-risk areas, secrets, privileged credentials, or disallowed command patterns are required
- `blocked`: tracker, VCS, LLM, git state, config, or validation environment is not usable

### Clarification and Resume Rules

- The agent posts 1-3 concrete questions in a single task comment marked with a stable comment marker.
- After posting clarification, the task returns to `To Do`.
- The supervisor polls sequentially and resumes only when a human updates the task or comments after the last clarification marker.
- If `max_clarification_rounds` is exceeded, the task moves to `Blocked`.

### Idempotency Rules

- The agent creates one lock file per active task under `.ai-agent/locks/`.
- Branch names are deterministic: `<branch_prefix>/<task-id>-<slug>`.
- The agent creates at most one open PR/MR per task branch.
- Agent comments are deduplicated by stable markers.

## 8. Runtime Artifacts

Each task should produce:

- `research.md`
- `plan.md`
- `progress.json`
- `implementation.log`
- `test.md`
- `self-review.md`

Artifact meaning:

- `research.md`: what the agent learned about the task, codebase area, and constraints
- `plan.md`: what the agent intends to change, how it will validate the change, and what stays out of scope

Recommended runtime layout:

```text
.ai-agent/
  config.yaml
  state/
  tasks/
  logs/
  locks/
```

## 9. Debugging and Observability

A human should be able to debug any task run from the task folder without guessing from the PR/MR alone.

Minimum debugging flow:

1. Open `progress.json` to see current stage, decision, retries, branch, and PR/MR link.
2. Read `research.md` to see what the agent understood from the task.
3. Read `plan.md` to see the chosen implementation approach.
4. Read `implementation.log` to see commands, timestamps, exit codes, and errors.
5. Read `test.md` to see compact validation results.
6. Read `self-review.md` to see declared risks, gaps, and review focus.
7. Inspect the task branch and diff to verify the exact code changes.

Each run should record at minimum:

- `execution_id`
- task ID and task URL
- current stage and stage transition timestamps
- decision gate result and reason
- clarification questions and received answers
- files read
- files changed
- commands run
- command exit codes
- repair attempt count
- branch name
- PR/MR URL if created
- LLM token usage and estimated cost
- total execution time
- last error

## 10. Use Cases

### Use Case 1: Happy-Path Bug Fix

A ticket has clear acceptance criteria. The agent analyzes it, implements a small fix, updates tests, passes checks, creates a PR/MR, and moves the task to `In Review`.

### Use Case 2: Clarification Required

The task is valid but expected behavior is unclear. The agent adds 1-3 concrete questions as a task comment, returns the task to `To Do`, and retries after the task is updated with answers.

### Use Case 3: Unsafe or Too Large Task

The task touches forbidden areas or is too broad for a safe small MR. The agent does not change code, explains the reason, suggests decomposition or next steps, and moves the task to `Blocked`.

### Use Case 4: Failed Checks and Repair Loop

The first implementation fails tests, lint, or build. The agent retries within limits. If it succeeds, it creates a normal PR/MR. If the result is still useful but unresolved, it creates a draft PR/MR with explicit failures.

### Use Case 5: Resume After Restart

The agent is interrupted mid-task. On restart, it reloads task state, reuses the existing branch/PR if present, avoids duplicates, and resumes from the last safe step.

## 11. Functional Requirements

- `agent init` creates runtime folders, config template, and instruction template.
- `agent doctor` validates repo, integrations, auth, and required commands.
- `agent run` supports supervisor mode and single-task mode.
- Supervisor mode is sequential only in MVP and must never run concurrent workers.
- Tasks are filtered by status and the explicit eligibility label `ai-auto`.
- The agent must read project instructions from `AGENTS.md`.
- All code changes happen on a task-specific branch.
- Clarification is limited to 1-3 questions posted as a task comment.
- Validation uses configured `test`, `lint`, and `build/typecheck` commands.
- Validation must also run a secret scan such as `gitleaks` or an equivalent check.
- Repair attempts are bounded.
- PR/MR creation supports draft mode when confidence or checks are incomplete.
- Self-review must include diff-vs-plan mismatches, forbidden-path scan result, test gaps, declared risks, and reviewer focus.
- State, logs, and branch/PR mapping must survive restart.
- The agent must avoid duplicate branches, comments, and PRs/MRs.
- Commands must come only from configured allowlisted commands; task text must never be executed as shell input.
- The agent must not read secret files unless explicitly configured, and secret values must never be sent to the LLM or logs.
- A kill switch must stop new task pickup and automatic resume after manual intervention.
- Every run must be debuggable from task artifacts without reading raw provider logs.

## 12. Minimal Config

Project config should define only:

- tracker provider, statuses, and eligibility label
- VCS provider, default/target branch, and branch prefix
- LLM provider/model
- auth env vars for tracker, VCS, and LLM
- commands: `test`, `lint`, `build/typecheck`, `secret-scan`
- optional project-specific forbidden paths
- optional override limits for clarification rounds, repair attempts, and task budget
- enabled/paused kill-switch flag

Built-in defaults should cover the rest:

- sequential execution: `max_parallel_tasks = 1`
- small-diff limits from the Small Diff Rubric
- default forbidden paths: `migrations/`, `.github/`, `infra/`, `deploy/`, `terraform/`, `.env`, `secrets/`, `**/auth/**`, `**/payments/**`, `Dockerfile`, `*.lock`
- default high-risk keywords: `password`, `secret`, `token`, `auth`, `permission`, `migrate`, `drop`, `payment`, `pii`
- allowlisted commands derived from configured commands
- stable comment marker format managed by the agent

## 13. Success Metrics

- `reviewable PR/MR` means: scoped to the task, no forbidden-path changes, validation status is explicitly reported, and a human reviewer does not need to reconstruct missing context from raw logs
- `unrelated files` means: files outside the planned module plus directly related tests/docs
- all 5 core use cases work in demo
- at least 10 internal tasks tested
- at least 6 of 10 produce a reviewable PR/MR
- at least 8 of 10 correctly report validation status
- less than 20 percent of runs change unrelated files
- median time from pickup to PR/MR is at most 30 minutes on the pilot repo
- average task cost stays within the configured budget
- at least 50 percent of failed-check tasks converge within the repair-attempt limit
- zero cases of auto-merge, auto-deploy, or secret leakage

## 14. 2-Week Delivery Plan

### Week 1

- Person 1: task tracker integration and status/comments flow
- Person 2: VCS integration, branch handling, PR/MR creation
- Person 3: supervisor loop, task worker, state machine
- Person 4: prompts, research/plan generation, decision gate

Target:

- happy path works on one demo repo
- mid-week sync locks auth, config shape, eligibility rule, and demo repo

### Week 2

- Person 1: clarification flow and blocked flow
- Person 2: validation runner and repair loop
- Person 3: idempotency, resume, logs, doctor command
- Person 4: self-review, policy guard, forbidden-path checks, demo prep

Target:

- all 5 use cases demonstrated end-to-end

## 15. Definition of Done

The MVP is done when the team can demonstrate the scenarios below, and scenarios 1 and 4 succeed on at least 60 percent of the pilot task set within configured time and cost budgets:

1. happy-path bug fix
2. clarification flow
3. blocked/unsafe refusal
4. failed checks with repair or draft PR/MR
5. restart/resume without duplication
6. operation within configured time and cost budget

## 16. Positioning

Position it as:

"An AI draft-PR agent for small approved engineering tasks."

Do not position it as:

- a full autonomous developer
- a replacement for engineers
- a system that can safely handle any backlog item
