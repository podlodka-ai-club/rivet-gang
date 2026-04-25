# Story 1.1: Bootstrap CLI and Linear Tracker Integration

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an operator,
I want the CLI project foundation and Linear tracker integration configured first,
so that the agent can verify Linear access, inspect eligible issues, update issue statuses, and post comments before any automated task execution is attempted.

## Acceptance Criteria

1. Given a fresh repository, when an operator runs `rg init`, then the CLI creates the expected `.ai-agent/` runtime folders and a configuration template that includes Linear tracker settings.
2. Given missing Linear authentication configuration, when an operator runs `rg doctor`, then the command reports Linear authentication as failed without printing secret values.
3. Given valid Linear authentication configuration, when an operator runs `rg doctor`, then the command verifies Linear access and reports the tracker check as passed.
4. Given configured Linear statuses and the `ai-agent` eligibility label, when the tracker adapter checks issues, then it returns only Linear issues matching the configured automation rules and carrying the `ai-agent` label.
5. Given a target Linear issue and a configured status, when the tracker adapter updates status, then the issue is moved through the adapter interface without provider-specific payloads leaking into core logic.
6. Given a target Linear issue and comment body, when the tracker adapter adds a comment, then it writes one agent-marked comment suitable for later deduplication.
7. Given any Linear API or authentication failure, when the CLI reports the result, then it normalizes the failure into a typed integration error that can be surfaced by `rg doctor` or later workflow code.
8. Given repository instructions exist in `AGENTS.md`, when the CLI prepares for task analysis, then those instructions are loaded before planning or code changes.

## Tasks / Subtasks

- [x] Initialize the TypeScript `oclif` CLI package in the repository root. (AC: 1)
  - [x] Use `rg` as the executable bin name.
  - [x] Keep generated or adapted command files under `src/commands/`.
  - [x] Remove or replace starter sample commands so the first public commands are `init`, `doctor`, and `run`.
- [x] Implement the minimum `rg init` behavior. (AC: 1)
  - [x] Create `.ai-agent/state/`, `.ai-agent/tasks/`, `.ai-agent/logs/`, and `.ai-agent/locks/`.
  - [x] Create `.ai-agent/config.yaml` only when missing.
  - [x] Include Linear tracker provider, status names, auth env var name, and default eligibility label `ai-agent` in the template.
  - [x] Make the command idempotent and non-destructive for existing local runtime state.
- [x] Define configuration and environment loading boundaries. (AC: 1, 2, 3)
  - [x] Add `src/config/` modules for defaults, config loading, and env lookup.
  - [x] Store credential references as environment variable names only.
  - [x] Do not persist or print credential values.
- [x] Define the tracker adapter interface and normalized tracker types. (AC: 4, 5, 6, 7)
  - [x] Put the interface in `src/adapters/tracker-adapter.ts` or a focused adjacent type file.
  - [x] Model normalized issue fields needed by the workflow: provider id, identifier, title, description, state, labels, URL, and updated timestamp where available.
  - [x] Model typed integration errors without exposing raw Linear payloads to `src/core/`.
- [x] Implement the initial Linear adapter behind the tracker interface. (AC: 3, 4, 5, 6, 7)
  - [x] Verify authentication with a low-risk read query.
  - [x] Fetch eligible issues by configured status and required `ai-agent` label.
  - [x] Update issue status by resolving or using the configured Linear workflow state id/name.
  - [x] Add comments with a stable agent marker for later deduplication.
  - [x] Check GraphQL `errors` even when HTTP status is 200.
- [x] Implement the minimum `rg doctor` tracker checks. (AC: 2, 3, 7)
  - [x] Report missing Linear auth/config as a failed check without printing secret values.
  - [x] Report successful Linear access as a passed tracker check.
  - [x] Return non-zero exit when required checks fail.
- [x] Add repository instruction loading. (AC: 8)
  - [x] Add a small module that reads `AGENTS.md` from the repo root.
  - [x] Return a typed loaded/missing/error result for later workflow use.
  - [x] Do not start planning or task execution logic in this story.
- [x] Add focused tests. (AC: 1-8)
  - [x] Command tests for `rg init` creating runtime directories and config.
  - [x] Command tests for `rg doctor` with missing Linear auth.
  - [x] Adapter contract tests using fixtures or mocked fetch responses for Linear success, GraphQL errors, auth failures, issue filtering, status update, and comments.
  - [x] Snapshot or output tests must assert that token values are not emitted.

### Review Findings

- [x] [Review][Patch] Wire the `rg` executable to the oclif command surface instead of an unbuilt source dispatcher [package.json:22]

## Dev Notes

### Scope Boundaries

This is the first implementation story. It should create the CLI foundation and the first Linear integration slice only.

In scope:
- TypeScript + Node.js + `oclif` package foundation.
- Public commands: `rg init`, `rg doctor`, and a minimal `rg run` placeholder if needed by the command surface.
- `.ai-agent/` runtime directory creation and initial config template.
- Linear tracker adapter interface and initial Linear implementation for auth check, eligible issue lookup, status update, and comments.
- Repository instruction loading from `AGENTS.md`.
- Focused tests for command behavior, config/env safety, and Linear adapter normalization.

Out of scope:
- Git branch creation.
- PR/MR creation.
- LLM planning or implementation workflow.
- Validation runner and repair loop.
- Multi-tracker support beyond a typed adapter boundary.
- Full task execution through `rg run`.
- Databases, caches, server components, background workers, CI/CD changes, and dependency upgrades unrelated to this story.

### Architecture Compliance

- Keep `src/commands/` thin: parse inputs, call config/state/adapter services, and map results to output or exit code.
- Put provider-specific Linear GraphQL code only in `src/adapters/`.
- Put config defaults and environment-variable lookup in `src/config/`.
- Put `.ai-agent/` path conventions in `src/state/`, not command files.
- Put shared normalized task, provider, result, and error contracts in `src/types/`.
- Do not let Linear payload shapes enter `src/core/`; normalize inside the adapter.
- Use explicit discriminated unions for outcomes and errors. Preserve the documented workflow statuses: `proceed`, `blocked`, `needsClarification`, `refuseUnsafe`, and `refuseTooLarge`.
- Use ISO 8601 strings for persisted timestamps and `camelCase` JSON keys.

### Expected File Structure

The repository currently has planning docs only and no package/source tree. Establish the root package here, not in a nested `rivet-agent/` folder.

Expected implementation areas:

```text
package.json
tsconfig.json
bin/
src/
  commands/
    init.ts
    doctor.ts
    run.ts
  adapters/
    tracker-adapter.ts
    linear-tracker-adapter.ts
  config/
    config.ts
    defaults.ts
    env.ts
  state/
    path-layout.ts
  types/
    errors.ts
    provider.ts
    task.ts
  util/
    fs.ts
test/
  commands/
  adapters/
  fixtures/
```

Adjust exact test folder naming to the generated `oclif` test setup if needed, but keep tests grouped by architecture boundary.

### CLI Foundation Notes

- The architecture selected `oclif`; the first implementation priority is the CLI command skeleton.
- Official oclif docs show `oclif generate NAME` for a new CLI and support options such as `--bin`, `--name`, `--output-dir`, `--package-manager`, `--module-type`, and `--yes`.
- Use the generator or manually adapt its output so the root repo package exports the `rg` command.
- Do not leave sample `hello` commands as the visible product surface.
- Prefer the generated TypeScript setup and the generated test setup unless doing so conflicts with the architecture.

### Linear Integration Notes

- Linear's public API is GraphQL at `https://api.linear.app/graphql`.
- For this MVP, support an environment-variable based token such as `LINEAR_API_KEY` through config. The config stores the env var name, not the token.
- Personal API key auth uses the `Authorization` header with the API key value. OAuth bearer auth exists, but a full OAuth flow is out of scope for this story unless already configured.
- GraphQL responses may include an `errors` array even when HTTP status is successful; normalize that into a typed integration error.
- The adapter should query only the fields needed for normalized issue data and should not return raw GraphQL nodes to core code.
- Status updates should use Linear's issue update mutation with a workflow state id once resolved from configured status names.
- Comments should use a stable marker in the body, for example an HTML comment marker, so later stories can deduplicate agent comments.

### Config Template Guidance

The `.ai-agent/config.yaml` template should include at least:

```yaml
tracker:
  provider: linear
  authEnv: LINEAR_API_KEY
  team: null
  eligibleStatuses:
    - To Do
  inAnalysisStatus: In Analysis
  inReviewStatus: In Review
  blockedStatus: Blocked
  clarificationReturnStatus: To Do
  eligibilityLabel: ai-agent
vcs:
  provider: github
  defaultBranch: main
  branchPrefix: ai-agent
llm:
  provider: null
  model: null
validation:
  test: null
  lint: null
  typecheck: null
  secretScan: null
limits:
  maxParallelTasks: 1
  maxClarificationRounds: 1
  maxRepairAttempts: 2
killSwitch:
  enabled: false
```

Keep this template conservative. Later stories can expand validation, VCS, LLM, and policy behavior.

### Testing Requirements

- Tests must not require live Linear access.
- Use fixtures or mocked `fetch` responses for Linear GraphQL success and failure cases.
- Include a test where HTTP is 200 but GraphQL `errors` is present.
- Include a test where an issue has the configured status but lacks `ai-agent`, and ensure it is excluded.
- Include a test where an issue has `ai-agent` but an ineligible status, and ensure it is excluded.
- Include tests proving `rg doctor` output does not contain the configured Linear token value.
- Keep fixtures under `test/fixtures/`.

### Security Requirements

- Never read arbitrary secret files.
- Never log or print secret values.
- Never persist env var values in `.ai-agent/config.yaml`, JSON state, Markdown artifacts, stdout, stderr, or test snapshots.
- Do not execute task text as shell input.
- Do not add network calls outside the Linear adapter.

### Previous Story Intelligence

No previous story exists. This is the first implementation story.

### Latest Technical Context

- oclif currently documents TypeScript CLI generation, bin scripts, command files, and generator flags including `--bin` and `--output-dir`. Use that to keep the `rg` executable rooted in this repo. Source: https://oclif.io/docs/generator_commands/
- oclif templates include bin scripts, TypeScript config, package config, command examples, and tests using `@oclif/test` and Mocha. Source: https://oclif.io/docs/templates/
- Linear documents its GraphQL endpoint, personal API key and OAuth auth modes, `issueUpdate`, workflow states, issue queries, and GraphQL error handling. Source: https://workwithlinear.com/developers/graphql

### References

- [Source: /Users/aifedorov/rivet-gang/rg_bmad-output/planning-artifacts/epics.md#Story-1.1]
- [Source: /Users/aifedorov/rivet-gang/PRD.md#Functional-Requirements]
- [Source: /Users/aifedorov/rivet-gang/ARCHITECTURE.md#Core-Boundaries]
- [Source: /Users/aifedorov/rivet-gang/AGENTS.md#Module-Boundaries]
- [Source: /Users/aifedorov/rivet-gang/rg_bmad-output/planning-artifacts/architecture.md#Project-Structure-And-Boundaries]
- [Source: /Users/aifedorov/rivet-gang/rg_bmad-output/project-context.md#Critical-Implementation-Rules]
- [Source: https://oclif.io/docs/generator_commands/]
- [Source: https://oclif.io/docs/templates/]
- [Source: https://workwithlinear.com/developers/graphql]

## Dev Agent Record

### Agent Model Used

GPT-5

### Debug Log References

- `node /Users/aifedorov/.npm/_npx/bbdf4739ce68c653/node_modules/npm/bin/npm-cli.js install --package-lock-only`
- `node /Users/aifedorov/.npm/_npx/bbdf4739ce68c653/node_modules/npm/bin/npm-cli.js install`
- `node /Users/aifedorov/.npm/_npx/bbdf4739ce68c653/node_modules/npm/bin/npm-cli.js install --save-dev @types/node@^24.0.0`
- `./node_modules/.bin/tsc --noEmit`
- `node /Users/aifedorov/.npm/_npx/bbdf4739ce68c653/node_modules/npm/bin/npm-cli.js test`
- `node /Users/aifedorov/rivet-gang/bin/rg.js doctor`
- `node /Users/aifedorov/rivet-gang/bin/rg.js run`

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Implemented the root TypeScript package with `rg` bin, oclif command classes, and command handlers for `init`, `doctor`, and `run`.
- Implemented idempotent `.ai-agent/` runtime layout creation and a Linear-focused config template.
- Implemented config/env loading that stores and displays env var names only, not secret values.
- Implemented tracker adapter contracts, normalized Linear issue models, typed integration errors, Linear auth verification, eligible issue filtering, status updates, and marked comments.
- Implemented `AGENTS.md` repository instruction loading for later planning/task execution flows.
- Added focused command and adapter tests with mocked Linear responses; no live Linear calls are required.
- Resolved code review finding: `rg` now executes through oclif command discovery against built `dist/commands` output, and tests import built JS.

### File List

- .gitignore
- bin/rg.js
- package-lock.json
- package.json
- src/adapters/linear-tracker-adapter.ts
- src/adapters/tracker-adapter.ts
- src/cli.ts
- src/commands/doctor.ts
- src/commands/init.ts
- src/commands/run.ts
- src/config/config.ts
- src/config/defaults.ts
- src/config/env.ts
- src/state/path-layout.ts
- src/state/repository-instructions.ts
- src/types/errors.ts
- src/types/task.ts
- test/adapters/linear-tracker-adapter.test.mjs
- test/commands/doctor.test.mjs
- test/commands/init.test.mjs
- tsconfig.json

### Change Log

- 2026-04-25: Implemented Story 1.1 CLI bootstrap and Linear tracker integration slice; added TypeScript config, package metadata, adapter contracts, command handlers, mocked tests, and validation setup.
- 2026-04-25: Addressed code review finding by wiring `bin/rg.js` to oclif `execute`, switching source imports to buildable NodeNext `.js` specifiers, and validating built command discovery.
