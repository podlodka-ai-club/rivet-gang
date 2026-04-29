# Story 1.3: Readiness Doctor for Local Execution

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an operator,
I want `rg doctor` to report local execution readiness,
so that integration, repository, and command problems are visible before task automation starts.

## Acceptance Criteria

1. Given a configured repository, when an operator runs `rg doctor`, then the command reports pass or fail for repository access, Linear authentication, VCS configuration, LLM configuration, LLM API authentication/connectivity, and configured local commands.
2. Given LLM provider and model settings are configured, when `rg doctor` evaluates LLM readiness, then it verifies the configured LLM API can be reached with the configured auth environment variable and reports provider, model, and pass/fail status without printing secret values.
3. Given one readiness check fails, when `rg doctor` completes, then the command exits with a non-zero status and its terminal output identifies the failing check without requiring raw provider logs.
4. Given all readiness checks pass, when `rg doctor` completes, then the command exits successfully and the output is scannable in a terminal with one result per check.
5. Given a configured command is not allowlisted, when `rg doctor` evaluates configured commands, then it reports the command as an optional warning and it does not execute task text as shell input.

## Tasks / Subtasks

- [x] Expand runtime config for readiness checks. (AC: 1, 2)
  - [x] Add `llm.authEnv` and `llm.baseUrl` to `RuntimeConfig`, `defaultRuntimeConfig`, and `.ai-agent/config.yaml` template with default env var name `GR_LLM_API_KEY`.
  - [x] Validate LLM API settings when `llm.provider`, `llm.model`, or `llm.baseUrl` is configured; report typed config issues if LLM readiness cannot know which env var or endpoint to read.
  - [x] Keep actual credential values out of config, JSON serialization, Markdown, stdout, stderr, and logs.
- [x] Add an LLM adapter boundary for readiness verification. (AC: 1, 2, 3)
  - [x] Create `src/adapters/llm-adapter.ts` with a typed interface and OpenAI-compatible implementation.
  - [x] Use env-var-based bearer auth through `readEnv`; do not read secret files.
  - [x] Verify connectivity/auth by calling an OpenAI-compatible model metadata/listing endpoint only; do not send prompts, task text, repository instructions, or generated content.
  - [x] Normalize HTTP, auth, and invalid JSON failures into existing `IntegrationError`/`Result` shapes.
- [x] Expand `rg doctor` orchestration while keeping the command thin. (AC: 1-4)
  - [x] Continue checking repository instructions and Linear authentication.
  - [x] Add config validation, VCS configuration, LLM configuration/API, and local command readiness checks.
  - [x] Accumulate independent check results instead of returning early after the first missing credential.
  - [x] Return exit code `1` when any check fails and `0` only when all checks pass.
  - [x] Keep `formatDoctorResult` one-result-per-check and ensure output is stable for tests.
- [x] Add local command readiness checks without executing task text. (AC: 1, 5)
  - [x] Inspect configured `validation.test`, `validation.lint`, `validation.typecheck`, and `validation.secretScan` values.
  - [x] Treat null commands as clearly reported optional readiness warnings, not as implicit pass.
  - [x] Derive allowlisted command strings from configured validation commands only.
  - [x] Reject shell-control syntax such as pipes, redirects, command separators, command substitution, and chained logical operators as unsafe.
  - [x] Check command binary availability by resolving the first executable token on `PATH` using Node filesystem APIs, not by running the configured command through a shell.
- [x] Add focused tests for doctor readiness. (AC: 1-5)
  - [x] Test one failing check does not hide later checks.
  - [x] Test missing Linear and missing LLM auth env vars name the env vars without leaking values.
  - [x] Test successful Linear and LLM API checks using fake `fetch` implementations.
  - [x] Test LLM API failures normalize into safe doctor output.
  - [x] Test unsafe configured validation command is reported without execution.
  - [x] Test unavailable command binary is reported.
  - [x] Test all-pass output has one scannable result per check and exit code `0`.

### Review Findings

- [x] [Review][Patch] Verify local git/default branch readiness instead of passing VCS from config strings only [src/commands/doctor.ts:53]
- [x] [Review][Patch] Support linked Git worktree common refs when checking default branch readiness [src/policy/vcs-readiness.ts:82]
- [x] [Review][Patch] Validate branch refs as usable files instead of accepting any existing path [src/policy/vcs-readiness.ts:82]
- [x] [Review][Patch] Handle unreadable `.git` files as readiness failures instead of throwing [src/policy/vcs-readiness.ts:73]
- [x] [Review][Patch] Validate configured branch names and prefixes with Git-compatible ref rules [src/policy/vcs-readiness.ts:22]

## Dev Notes

### Scope Boundaries

This story completes the Epic 1 readiness surface. It should improve `rg doctor`; it should not start task execution.

In scope:
- Runtime config additions needed for LLM readiness: `llm.authEnv` and `llm.baseUrl`.
- Readiness checks for repository instructions, config validation, Linear authentication, VCS configuration, LLM configuration/API connectivity, and configured local commands.
- A minimal LLM adapter for readiness verification.
- Local command safety/availability inspection for configured validation commands.
- Focused command, config, and adapter tests.

Out of scope:
- Running validation commands.
- Implementing `rg run` task execution, supervisor mode, branch creation, LLM planning, code editing, PR/MR creation, or artifact persistence for task runs.
- Full policy layer for production command allowlisting beyond doctor readiness inspection.
- VCS provider API calls; this story checks VCS configuration and local repository/default branch readiness only.
- Adding databases, servers, background workers, remote orchestration, or dependency upgrades unrelated to this story.

### Existing Implementation To Build On

- `src/commands/doctor.ts` already exposes `runDoctorCommand` and `formatDoctorResult`; keep the command class thin and move provider details into adapters or focused helpers.
- `src/config/config.ts` now returns typed validation results through `loadRuntimeConfigValidation`; prefer that over `loadRuntimeConfig` when doctor needs to surface config failures.
- `src/config/defaults.ts` owns the config template and default runtime config.
- `src/config/env.ts` reads environment variables and should be reused for both Linear and LLM credentials.
- `src/adapters/linear-tracker-adapter.ts` already shows the adapter pattern, fake-fetch test seam, and error normalization approach to mirror.
- `src/state/repository-instructions.ts` already returns `loaded`, `missing`, or `error` for `AGENTS.md`.
- Tests import built JS from `dist`; run `npm test` or `npm run build` before direct test execution.

### Architecture Compliance

- Keep `src/commands/doctor.ts` responsible for assembling checks and formatting results only.
- Put OpenAI-compatible HTTP behavior in `src/adapters/llm-adapter.ts`; do not put provider payload parsing in `src/commands/`.
- Keep command safety helpers in a focused module such as `src/policy/command-readiness.ts` or `src/util/command-readiness.ts`; do not create a broad `utils.ts`.
- Use existing `Result` and `IntegrationError` shapes from `src/types/errors.ts`.
- Do not add an SDK dependency for the LLM readiness check; use Node `fetch` so the check stays small and testable.
- Preserve secret boundaries: env var names may appear, secret values must not.

### LLM Readiness Requirements

For MVP, support any provider that exposes an OpenAI-compatible model metadata endpoint and bearer API-key authentication. `llm.provider` is an operator-facing label; `llm.baseUrl` identifies the provider endpoint used for the readiness check.

The config template should include:

```yaml
llm:
  provider: null
  model: null
  authEnv: GR_LLM_API_KEY
  baseUrl: null
```

If `provider`, `model`, or `baseUrl` is null, `rg doctor` should fail the LLM configuration check with a clear operator-facing message. If all are configured, it should read only the env var named by `llm.authEnv`, verify the configured API using bearer auth, and report provider/model without printing the token.

Use a metadata/listing endpoint for readiness, for example `GET <llm.baseUrl>/models/{model}`. Do not call a generation endpoint and do not send prompts.

### Local Command Readiness Guidance

The configured command values are strings because they are operator-facing config. For this story, do not execute those strings.

Recommended behavior:
- Missing/null command: warn with `not configured`.
- Contains shell control syntax: warn with `unsafe`.
- First executable token cannot be resolved on `PATH`: warn with `unavailable`.
- Otherwise: pass as `available`.

Reject at least these patterns: `|`, `>`, `<`, `;`, `&&`, `||`, backticks, `$(`, and newline characters.

### Testing Requirements

- Continue using Node's built-in test runner through `npm test`.
- Add adapter contract tests under `test/adapters/` for LLM API success, HTTP failure, invalid JSON, and auth failure.
- Add command tests under `test/commands/doctor.test.mjs` for multi-check output and non-leakage.
- Add config tests under `test/config/config.test.mjs` for `llm.authEnv` and `llm.baseUrl` parsing/defaults and incomplete LLM config behavior.
- Ensure fake fetch assertions prove `Authorization: Bearer <token>` is used for the LLM API while formatted output never contains `<token>`.
- Ensure unsafe configured commands are never executed. Prefer a test command string that would create a sentinel file if executed, and assert the sentinel file does not exist.

### Security Requirements

- Credentials come only from explicitly configured environment variables.
- Do not read arbitrary secret files.
- Do not log secret values.
- Do not send secret values, prompts, task text, repository instructions, or generated content to the LLM during doctor checks.
- Do not execute configured validation command strings in this story.

### Previous Story Intelligence

Story 1.2 completed these relevant foundations:
- Expanded `RuntimeConfig` to tracker, VCS, LLM, validation, limits, and kill-switch sections.
- Added `loadRuntimeConfigValidation` with typed validation failures for invalid config.
- Added `loadRuntimeContext` that composes config validation and safe `AGENTS.md` metadata without serializing raw instruction content.
- Fixed parser behavior so explicit empty lists, malformed numeric limits, and malformed kill-switch booleans produce typed validation failures instead of silently defaulting.
- Full suite passed with 16 tests after Story 1.2.

Keep these patterns intact. Do not regress the parser fixes from Story 1.2.

### Latest Technical Context

OpenAI-compatible API authentication uses HTTP bearer auth with API keys loaded from environment variables; API keys are secrets and should not be exposed in client-side code or logs. Model listing/metadata requests under `/v1/models` using `Authorization: Bearer $GR_LLM_API_KEY` are suitable for a low-impact readiness check that does not send prompts.

### References

- [Source: /Users/aifedorov/rivet-gang/rg_bmad-output/planning-artifacts/epics.md#Story-1.3]
- [Source: /Users/aifedorov/rivet-gang/PRD.md#Project-Type-Requirements]
- [Source: /Users/aifedorov/rivet-gang/PRD.md#Functional-Requirements]
- [Source: /Users/aifedorov/rivet-gang/ARCHITECTURE.md#High-Level-Components]
- [Source: /Users/aifedorov/rivet-gang/ARCHITECTURE.md#Core-Boundaries]
- [Source: /Users/aifedorov/rivet-gang/ARCHITECTURE.md#Security-Model]
- [Source: /Users/aifedorov/rivet-gang/rg_bmad-output/project-context.md#Critical-Implementation-Rules]
- [Source: /Users/aifedorov/rivet-gang/rg_bmad-output/implementation-artifacts/1-2-runtime-configuration-and-repository-instructions.md]

## Dev Agent Record

### Agent Model Used

GPT-5

### Debug Log References

- `/Applications/Codex.app/Contents/Resources/node /Users/aifedorov/.npm/_npx/bbdf4739ce68c653/node_modules/npm/bin/npm-cli.js test` (red phase: failed before LLM adapter/config/doctor implementation)
- `/Applications/Codex.app/Contents/Resources/node /Users/aifedorov/.npm/_npx/bbdf4739ce68c653/node_modules/npm/bin/npm-cli.js test`
- `/Applications/Codex.app/Contents/Resources/node /Users/aifedorov/.npm/_npx/bbdf4739ce68c653/node_modules/npm/bin/npm-cli.js run build`
- `/Applications/Codex.app/Contents/Resources/node /Users/aifedorov/.npm/_npx/bbdf4739ce68c653/node_modules/npm/bin/npm-cli.js run typecheck`
- `/Applications/Codex.app/Contents/Resources/node /Users/aifedorov/.npm/_npx/bbdf4739ce68c653/node_modules/npm/bin/npm-cli.js test`
- `npm test` (red phase: VCS readiness tests failed before implementation)
- `npm test`
- `npm run build`
- `npm run typecheck`
- `npm run lint`
- `npm run secretScan`
- `npm test` (red phase: review follow-up tests failed before VCS readiness hardening)
- `npm test`
- `npm run build`
- `npm run typecheck`
- `npm run lint`
- `npm run secretScan`

### Implementation Plan

- Extend config first so doctor can read LLM auth env names deterministically.
- Add provider HTTP readiness behind an LLM adapter, mirroring the existing Linear adapter pattern.
- Add command-readiness inspection as policy code that never invokes configured shell strings.
- Keep `doctor.ts` as orchestration and output formatting only.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Added `llm.authEnv` and `llm.baseUrl` to runtime config parsing, defaults, and validation.
- Added `OpenAiCompatibleLlmAdapter` for model metadata readiness checks with bearer auth and normalized integration errors.
- Expanded `rg doctor` to report repository access, repository instructions, config validation, VCS configuration, Linear auth, LLM config/auth/API, and configured validation command readiness.
- Added command readiness policy checks for missing, unsafe, and unavailable configured commands without executing task text.
- Added config, adapter, and doctor tests; build, typecheck, and full test suite pass with 23 tests.
- Added operator-facing fix guidance to failed doctor checks for missing LLM config, missing auth env vars, unsafe/unavailable commands, invalid config, and API failures.
- Added doctor test coverage for fix guidance; build, typecheck, and full test suite pass with 24 tests.
- Generalized LLM readiness from OpenAI-only config to provider label plus `llm.baseUrl` and `GR_LLM_API_KEY`; changed Linear readiness defaults to `GR_LINEAR_API_KEY`; clarified why validation command config is required for operator readiness.
- Added `llm.baseUrl` URL validation so shell commands or native generation endpoints are reported as config errors before API checks run; build, typecheck, and full test suite pass with 25 tests.
- Added repo-level `lint` and `secretScan` scripts so all validation readiness checks can be configured; `rg doctor` now passes test/lint/typecheck/secretScan command readiness locally.
- Changed validation command readiness from blocking failures to optional warnings; build, typecheck, and full test suite pass with 25 tests.
- Resolved review finding: `rg doctor` now verifies local Git metadata and the configured default branch ref before passing VCS readiness.
- Added VCS readiness regression tests for missing repository metadata and unavailable configured default branch; build, typecheck, lint, secret scan, and full test suite pass with 27 tests.
- Resolved code review follow-ups: linked worktree common refs are supported, branch refs must be usable files or packed refs with non-zero object IDs, unreadable `.git` files fail gracefully, and default branch plus branch prefix names use stricter Git ref validation.
- Added VCS readiness regression tests for linked worktrees, directory/corrupt refs, and invalid branch prefixes; build, typecheck, lint, secret scan, and full test suite pass with 30 tests.

### File List

- src/adapters/llm-adapter.ts
- src/commands/doctor.ts
- src/config/config.ts
- src/config/defaults.ts
- src/policy/command-readiness.ts
- src/policy/vcs-readiness.ts
- src/types/errors.ts
- scripts/secret-scan.mjs
- package.json
- test/adapters/llm-adapter.test.mjs
- test/commands/doctor.test.mjs
- test/config/config.test.mjs
- rg_bmad-output/implementation-artifacts/1-3-readiness-doctor-for-local-execution.md
- rg_bmad-output/implementation-artifacts/sprint-status.yaml

### Change Log

- 2026-04-25: Implemented Story 1.3 readiness doctor checks for config, VCS, Linear, LLM API, and local command readiness.
- 2026-04-25: Added operator fix guidance to failed `rg doctor` checks.
- 2026-04-25: Generalized LLM readiness to OpenAI-compatible providers via `llm.baseUrl` and `GR_LLM_API_KEY`.
- 2026-04-25: Scoped default API-key env vars to the agent: `GR_LINEAR_API_KEY` and `GR_LLM_API_KEY`.
- 2026-04-25: Added validation for malformed `llm.baseUrl` values.
- 2026-04-25: Added local lint and secret-scan validation commands.
- 2026-04-25: Made validation command readiness advisory warnings instead of blocking failures.
- 2026-04-25: Addressed code review finding by validating local Git metadata and default branch readiness in `rg doctor`.
- 2026-04-25: Addressed second code review findings by hardening VCS readiness for linked worktrees, corrupt refs, unreadable `.git` files, and invalid ref names.
