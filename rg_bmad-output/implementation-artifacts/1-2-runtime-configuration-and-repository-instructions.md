# Story 1.2: Runtime Configuration and Repository Instructions

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an operator,
I want project configuration and repository instructions loaded deterministically,
so that every run uses the same local rules, credential references, and safety defaults.

## Acceptance Criteria

1. Given a repository with `AGENTS.md`, when the CLI loads runtime configuration, then it reads `AGENTS.md` before any planning or code-change workflow can proceed and records whether repository instructions were loaded successfully.
2. Given no `.ai-agent/config.yaml` exists, when an operator runs `rg init`, then the command creates `.ai-agent/config.yaml` from a template and the template includes tracker, VCS, LLM, validation, secret-scan, branch prefix, status, eligibility label, kill-switch, and limit settings.
3. Given configuration references credentials, when config validation runs, then only environment variable names are read from config and secret values are not persisted to JSON, Markdown, logs, stdout, or stderr.
4. Given required runtime directories are missing, when an operator runs `rg init`, then the command creates `.ai-agent/state/`, `.ai-agent/tasks/`, `.ai-agent/logs/`, and `.ai-agent/locks/` and can be rerun without deleting existing runtime state.

## Tasks / Subtasks

- [x] Extend the runtime config contract beyond tracker-only parsing. (AC: 2, 3)
  - [x] Add typed config sections for tracker, VCS, LLM, validation, limits, and kill switch.
  - [x] Preserve existing tracker fields from Story 1.1: provider, auth env var name, eligible statuses, and eligibility label.
  - [x] Include configured status names for analysis, review, blocked, and clarification return states.
  - [x] Keep credential values out of config types; store only env var names such as `LINEAR_API_KEY`.
- [x] Make config loading deterministic and validation-oriented. (AC: 1, 2, 3)
  - [x] Parse the existing `.ai-agent/config.yaml` template into the expanded typed config shape.
  - [x] Return explicit validation results for missing/invalid required config fields rather than throwing generic errors for expected config problems.
  - [x] Default missing optional values conservatively without inventing provider behavior outside the story.
  - [x] Do not add a broad YAML dependency unless the existing parser becomes unsafe for the required template shape.
- [x] Add a runtime context loader that composes config and repository instructions. (AC: 1, 3)
  - [x] Read `AGENTS.md` before returning a context that any planning or code-change workflow can use.
  - [x] Record instruction load status as `loaded`, `missing`, or `error` with path and safe metadata.
  - [x] Do not persist raw `AGENTS.md` content into JSON state or logs in this story.
  - [x] Do not start task analysis, LLM planning, git branch creation, or code-change execution.
- [x] Preserve and verify `rg init` runtime layout behavior. (AC: 2, 4)
  - [x] Keep `.ai-agent/state/`, `.ai-agent/tasks/`, `.ai-agent/logs/`, and `.ai-agent/locks/` creation in `src/state/path-layout.ts`.
  - [x] Keep config creation idempotent: create only when missing and never overwrite existing local runtime state.
  - [x] Update the config template only if required to match the expanded typed config contract.
- [x] Add focused tests for config and instruction loading. (AC: 1-4)
  - [x] Test the generated config template parses into the expanded runtime config.
  - [x] Test missing `.ai-agent/config.yaml` falls back to safe defaults without reading secret values.
  - [x] Test invalid or incomplete config produces typed validation failures.
  - [x] Test `AGENTS.md` load status is recorded as loaded, missing, and error where practical.
  - [x] Test `rg init` still creates runtime directories and does not overwrite config.
  - [x] Test stdout/stderr and any serialized validation results do not contain secret values.

### Review Findings

- [x] [Review][Patch] Preserve explicitly empty `eligibleStatuses` so validation can reject it [src/config/config.ts:249]
- [x] [Review][Patch] Report malformed numeric limit values instead of silently falling back to defaults [src/config/config.ts:259]
- [x] [Review][Patch] Report malformed kill-switch boolean values instead of silently falling back to defaults [src/config/config.ts:276]

## Dev Notes

### Scope Boundaries

This story extends the configuration and repository-instruction foundation created in Story 1.1. It should not reimplement the CLI bootstrap or Linear adapter.

In scope:
- Expand `RuntimeConfig` from tracker-only to the complete MVP config shape described by the PRD.
- Add deterministic validation results for config correctness.
- Compose runtime config and repository instruction load status into a single safe runtime context for later workflows.
- Keep `rg init` idempotent and ensure its template matches the expanded config contract.
- Add tests under the existing Node test setup.

Out of scope:
- Running validation commands.
- Command allowlist enforcement.
- VCS, LLM, or secret-scan adapter implementation.
- Task analysis, LLM planning, branch creation, PR/MR creation, or workflow execution.
- Persisting task artifacts such as `research.md`, `plan.md`, `progress.json`, `implementation.log`, `test.md`, or `self-review.md`.
- Adding a database, cache, server process, background worker, CI/CD change, or remote orchestration.

### Existing Implementation From Story 1.1

Build on these files instead of duplicating them:

- `src/config/defaults.ts`: contains the current `.ai-agent/config.yaml` template and tracker defaults.
- `src/config/config.ts`: currently parses tracker auth env, eligible statuses, and eligibility label.
- `src/config/env.ts`: reads environment variables without changing config shape.
- `src/state/path-layout.ts`: creates `.ai-agent/` directories and writes config only when missing.
- `src/state/repository-instructions.ts`: reads `AGENTS.md` and returns `loaded`, `missing`, or `error`.
- `src/commands/init.ts`: calls `ensureRuntimeLayout`.
- `src/commands/doctor.ts`: already checks repository instructions and Linear auth.
- `test/commands/init.test.mjs` and `test/commands/doctor.test.mjs`: cover the current init and doctor behavior.

Story 1.1 completed one review fix: `rg` now executes through oclif command discovery against built `dist/commands`, and tests import built JS. Keep that build/run behavior intact.

### Architecture Compliance

- Keep command files thin. `rg init` should call state/config services, not own config parsing or validation logic.
- Keep config parsing and validation in `src/config/`.
- Keep repository instruction file reading in `src/state/` or a focused module at the same boundary; do not move it into command files.
- If a runtime context composer is added, place it in a boundary that does not perform provider calls or workflow decisions. `src/config/runtime-context.ts` or a focused `src/core/runtime-context.ts` is acceptable; avoid dumping it into a generic helper.
- Keep provider-specific payloads out of config and core logic.
- JSON-facing field names must be `camelCase`; timestamps must be ISO 8601 strings if added.
- Use explicit discriminated unions for validation outcomes, for example `valid`, `invalid`, or `missing`, rather than throwing for expected operator config problems.

### Config Shape Requirements

The typed config should cover these sections at minimum:

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

Do not store actual credentials in this config. Only env var names belong here.

### Parser Guidance

The current parser in `src/config/config.ts` is intentionally small and tailored to the current template. For Story 1.2, either:

- extend it carefully for the fixed template shape using deterministic helper functions, or
- introduce a minimal YAML parser dependency only if the implementation cannot remain safe and readable without it.

If adding a dependency, keep it narrowly justified in the dev notes and tests. Do not introduce broad config frameworks.

### Testing Requirements

- Continue using Node's built-in test runner through `npm test`.
- Because tests import built JS from `dist`, run `npm test` or `npm run build` before direct test execution.
- Add config-focused tests under `test/config/` if new config modules are added.
- Add state/runtime-context tests under `test/state/` or `test/config/` based on the module boundary chosen.
- Include negative tests for incomplete config, not just the happy path.
- Include at least one assertion that secret values from `process.env` do not appear in formatted config validation output or serialized results.

### Security Requirements

- Credentials come only from explicitly configured environment variables.
- Config loading may report env var names but must not read or persist env var values unless a later command explicitly needs them.
- Do not log secret values.
- Do not read arbitrary secret files.
- Do not execute configured validation commands in this story.

### Previous Story Intelligence

Story 1.1 is complete and should be treated as the baseline:

- oclif package foundation exists with `rg` bin and commands `init`, `doctor`, and `run`.
- `rg init` currently creates `.ai-agent/` runtime folders and a config template.
- The config template already contains tracker, VCS, LLM, validation, limits, and kill-switch sections, but typed parsing currently covers only tracker subset fields.
- `loadRepositoryInstructions` already reads `AGENTS.md`; this story should integrate that result into a deterministic runtime-context shape for later planning/code-change workflows.
- Tests are currently grouped under `test/commands/` and `test/adapters/`, with build output ignored through `.gitignore`.

### Latest Technical Context

No new external API behavior is required for this story. Prefer existing project dependencies and Node built-ins. The current package already uses:

- `@oclif/core` for command classes and command discovery.
- TypeScript with `moduleResolution: NodeNext`.
- Node's built-in test runner.

Do not change the dependency set unless config parsing cannot be made deterministic and safe with the current fixed template constraints.

### References

- [Source: /Users/aifedorov/rivet-gang/rg_bmad-output/planning-artifacts/epics.md#Story-1.2]
- [Source: /Users/aifedorov/rivet-gang/rg_bmad-output/implementation-artifacts/1-1-bootstrap-cli-and-linear-tracker-integration.md]
- [Source: /Users/aifedorov/rivet-gang/PRD.md#Project-Type-Requirements]
- [Source: /Users/aifedorov/rivet-gang/PRD.md#Functional-Requirements]
- [Source: /Users/aifedorov/rivet-gang/ARCHITECTURE.md#Core-Boundaries]
- [Source: /Users/aifedorov/rivet-gang/AGENTS.md#Module-Boundaries]
- [Source: /Users/aifedorov/rivet-gang/rg_bmad-output/project-context.md#Critical-Implementation-Rules]

## Dev Agent Record

### Agent Model Used

GPT-5

### Debug Log References

- `node /Users/aifedorov/.npm/_npx/bbdf4739ce68c653/node_modules/npm/bin/npm-cli.js test`
- `node /Users/aifedorov/.npm/_npx/bbdf4739ce68c653/node_modules/npm/bin/npm-cli.js run build`
- `node /Users/aifedorov/.npm/_npx/bbdf4739ce68c653/node_modules/npm/bin/npm-cli.js run typecheck`
- `/Applications/Codex.app/Contents/Resources/node /Users/aifedorov/.npm/_npx/bbdf4739ce68c653/node_modules/npm/bin/npm-cli.js run build`
- `/Applications/Codex.app/Contents/Resources/node /Users/aifedorov/.npm/_npx/bbdf4739ce68c653/node_modules/npm/bin/npm-cli.js run typecheck`
- `/Applications/Codex.app/Contents/Resources/node /Users/aifedorov/.npm/_npx/bbdf4739ce68c653/node_modules/npm/bin/npm-cli.js test`

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Expanded `RuntimeConfig` to include tracker statuses, VCS, LLM, validation, limits, and kill-switch sections.
- Added typed config validation results for expected operator configuration problems.
- Added a runtime context loader that composes config validation and safe repository-instruction metadata without serializing raw `AGENTS.md` content.
- Preserved existing `rg init` runtime layout behavior and config template shape.
- Added config and runtime-context tests; total suite now passes with 14 tests.
- Resolved review finding: explicitly empty `eligibleStatuses` now remains empty so config validation reports a typed issue.
- Resolved review finding: malformed or blank numeric limit values now produce typed validation failures instead of defaulting silently.
- Validation passed: build, typecheck, and full test suite with 15 passing tests.
- Resolved review finding: malformed kill-switch boolean values now produce typed validation failures instead of defaulting silently.
- Validation passed: build, typecheck, and full test suite with 16 passing tests.

### File List

- src/config/config.ts
- src/config/defaults.ts
- src/config/runtime-context.ts
- test/config/config.test.mjs
- test/config/runtime-context.test.mjs
- rg_bmad-output/implementation-artifacts/1-2-runtime-configuration-and-repository-instructions.md
- rg_bmad-output/implementation-artifacts/sprint-status.yaml

### Change Log

- 2026-04-25: Implemented Story 1.2 runtime config expansion, typed validation, safe runtime context loading, and config/instruction tests.
- 2026-04-25: Addressed Story 1.2 code review findings for explicit empty lists and malformed numeric limit validation.
- 2026-04-25: Addressed Story 1.2 code review finding for malformed kill-switch boolean validation.
