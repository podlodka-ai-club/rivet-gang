---
project_name: 'rivet-gang'
user_name: 'aifedorov'
date: '2026-04-25'
sections_completed:
  - 'technology_stack'
  - 'language_rules'
  - 'framework_rules'
  - 'testing_rules'
  - 'quality_rules'
  - 'workflow_rules'
  - 'anti_patterns'
existing_patterns_found: 14
status: 'complete'
rule_count: 91
optimized_for_llm: true
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

- Runtime: Node.js `>=22`, configured through `package.json#engines`.
- Language: TypeScript `^5.8.0` with `strict: true`, `module: NodeNext`, `moduleResolution: NodeNext`, and `target: ES2022`.
- Package format: ESM (`"type": "module"`). Source imports must use `.js` extensions for compiled TypeScript ESM paths.
- CLI framework: `@oclif/core` `^4.0.0`; command classes live under `src/commands/` and are exposed through `oclif.commands: ./dist/commands`.
- Test runner: Node built-in test runner via `node --test`; tests import compiled files from `dist`.
- Build: `npm run build` (`tsc`). Typecheck and lint currently both run `tsc --noEmit`.
- Secret scanning: local script `node scripts/secret-scan.mjs`.
- Runtime model: local-first, single-process CLI. No server, database, cache, workers, remote orchestration, or CI changes for MVP unless architecture docs are updated first.
- Dependency policy: keep dependencies minimal; prefer Node built-ins for filesystem, path handling, process execution, JSON serialization, and tests.

## Critical Implementation Rules

### Language-Specific Rules

- Use TypeScript for all implementation code under `src/`; emitted JavaScript belongs in `dist/` only.
- Keep source imports ESM-compatible by using `.js` extensions for relative imports, even when importing `.ts` source files.
- Keep `strict` TypeScript clean; do not use `any` or broad casts to bypass type errors unless there is a narrow, documented boundary reason.
- Keep internal models, function names, variables, and JSON state keys in `camelCase`.
- Use `PascalCase` for types, interfaces, and classes.
- Use ISO 8601 strings for timestamps in persisted state and artifacts.
- Represent workflow outcomes as explicit discriminated unions with fixed `status` values: `proceed`, `blocked`, `needsClarification`, `refuseUnsafe`, and `refuseTooLarge`.
- Do not invent alternate workflow status names without updating architecture docs first.
- Use explicit discriminated unions for command/core outcomes and adapter results.
- Reuse the existing `Result<T, IntegrationError>` pattern for provider failures instead of throwing from adapters for expected integration errors.
- Normalize external provider payloads inside adapters before returning data to core logic.
- Keep provider-specific field names and raw payload assumptions out of `src/core/`.
- Keep provider-specific raw fields and GraphQL response shapes out of `src/core/` and command modules.
- Prefer `async`/`await` for asynchronous workflow code so checkpointing and side-effect ordering stay readable.
- Keep JSON persistence and Markdown artifact writing as separate responsibilities.

### Framework-Specific Rules

- Use `@oclif/core` for first-class CLI commands; current commands are `init`, `doctor`, and `run`.
- Keep command classes in `src/commands/` thin: parse flags, call command/core functions, print formatted results, and exit with the typed exit code.
- Export pure command functions such as `runInitCommand`, `runDoctorCommand`, and `runRunCommand` so tests and legacy CLI paths can exercise behavior without invoking oclif internals.
- Do not put workflow orchestration, provider-specific logic, policy checks, or artifact-shape decisions directly inside `src/commands/`.
- Put workflow orchestration in `src/core/`, provider integrations in `src/adapters/`, policy checks in `src/policy/`, persistence in `src/state/`, config loading in `src/config/`, shared contracts in `src/types/`, and focused helpers in `src/util/`.
- `rg run` must support supervisor mode and single-task mode, but supervisor mode must remain sequential in MVP.
- Preserve `rg run` non-status execution as blocked until the relevant story implements task execution.
- Keep `rg run --status-only` read-only: no Linear mutations, branch creation, file writes, validation command execution, or LLM calls.
- CLI output should be scannable and non-interactive by default so commands are safe in automated environments.
- Avoid adding a web UI, HTTP API, server process, database, cache, event bus, or concurrent worker framework for MVP.

### Testing Rules

- Group tests by architectural boundary under `test/`: commands, core, adapters, policy, state, config, and types.
- Use Node's built-in test runner (`node --test`), not Jest/Vitest, unless the architecture is updated.
- Tests import compiled ESM output from `dist`, so run `npm test` or `npm run build` before boundary-specific test scripts.
- Add contract-style tests for adapters so provider payload normalization stays outside core logic.
- Use fake `fetchFn` injections for Linear/LLM adapter tests; never hit real external APIs in tests.
- Keep fixtures under `test/fixtures/`.
- Prefer small focused tests over broad integration scaffolding unless the active story needs integration coverage.
- Test workflow outcome discriminated unions and duplicate-prevention behavior around branch, comment, and PR/MR creation.
- Assert secret redaction behavior when testing auth/API failures.
- For read-only command modes, test both forbidden provider mutations and local side effects such as file-tree changes.
- When adding config or policy behavior, test both valid and invalid cases with typed result assertions.
- Test state persistence separately from Markdown artifact rendering.
- Cover policy rules for command allowlists, forbidden paths, secret boundaries, and small-diff safety before testing higher-level workflows.
- Avoid overbuilding test infrastructure before the module boundaries exist.
- Run the validation set before marking stories done: `npm test`, `npm run build`, `npm run typecheck`, `npm run lint`, and `npm run secretScan`.

### Code Quality & Style Rules

- Use kebab-case for source file names where appropriate; command files should be named by command, such as `init.ts`, `doctor.ts`, and `run.ts`.
- Keep module boundaries strict: commands parse and print, core orchestrates, adapters integrate providers, config parses/defaults, policy decides safety, state owns filesystem layout, types define shared contracts.
- Do not create broad dumping-ground files such as `utils.ts` or `helpers.ts`; helpers belong in focused modules under `src/util/`.
- Prefer editing existing files over creating new modules unless a boundary already exists or the story requires a new boundary.
- Keep diffs minimal and scoped to the active story. Do not make opportunistic refactors or unrelated formatting changes.
- Do not add dependencies unless the active story clearly needs them and existing Node/TypeScript APIs are insufficient.
- Do not add comments, docstrings, or type annotations to code you did not change.
- Add abstractions only when they protect an established boundary or remove real duplication in the active implementation.
- Keep command modules free of workflow logic, provider-specific payload parsing, and artifact layout decisions.
- Keep adapters free of workflow decisions and business rules.
- Keep state modules focused on path conventions, checkpoint writes, artifact persistence, locks, and deterministic artifact names.
- Keep policy modules focused on returning typed safety/scope decisions rather than performing broad side effects.
- Update `ARCHITECTURE.md` before introducing databases, caches, server components, microservices, background workers, remote orchestration, CI/CD changes, or unrelated dependency upgrades.

### Development Workflow Rules

- Read `AGENTS.md`, `PRD.md`, `ARCHITECTURE.md`, the relevant story file, and this project context before implementing a story.
- For non-trivial or cross-machine work, create or update one canonical execution plan under `docs/exec-plans/active/`.
- Execution-plan frontmatter must include task, branch, status, owner, updatedAt, PR link, and source documents.
- Treat repo-tracked docs, branches, PRs/MRs, and review comments as shared coordination state.
- Treat `.ai-agent/` as machine-local runtime state; never assume another machine can resume from it.
- Before pausing, handoff, or context switch, update the active execution plan with current status, scope decisions, blockers, and next actions.
- When work finishes, move or rewrite the execution plan into `docs/exec-plans/completed/`.
- Do not commit, push, merge, rebase, force-push, reset hard, or delete branches without explicit user approval.
- Always show the diff before committing.
- Never skip pre-commit hooks.
- Do not add `Co-Authored-By` trailers to commits.
- Keep generated review prompt files out of commits unless the user explicitly asks to preserve them.
- Use story/sprint status files in `rg_bmad-output/implementation-artifacts/` as BMAD workflow state.
- Mark stories `review` only after implementation and validation pass; mark stories `done` only after review findings are resolved or intentionally deferred.
- Keep branch names deterministic for task execution using `<branch_prefix>/<task-id>-<slug>` when implementing agent-managed tasks.

### Critical Don't-Miss Rules

- Do not execute task text as shell input. Only run commands from configured allowlists.
- Do not read arbitrary secret files. Credentials must come only from explicitly configured environment variables.
- Never log, print, persist, or send secret values to an LLM. Error output may include env var names only when they are safe variable-name strings.
- Run allowlist checks and forbidden-path checks before file edits and before PR/MR creation.
- Persist checkpoints before side effects that can duplicate external state, including tracker comments, branch creation, and PR/MR creation.
- Do not create duplicate branches, clarification comments, or open PRs/MRs for the same task branch.
- Read-only command modes must be tested for both external mutations and local filesystem changes.
- If a provider pagination response is inconsistent, fail closed instead of returning a partial success.
- If acceptance criteria, expected behavior, scope, edge cases, or test expectations are unclear, ask 1-3 concrete clarification questions in one tracker comment and return the task to `To Do`.
- If a task exceeds the small-diff rubric or touches forbidden/high-risk areas, refuse or block instead of continuing normal implementation.
- Keep supervisor mode sequential only; do not add concurrent workers in MVP.
- Do not introduce distributed runtime coordination. Local lock files are machine-local only and are not a shared lock service.
- Do not use `.ai-agent/` for cross-machine handoff. Promote durable handoff notes into `docs/exec-plans/`.
- Do not create review-ready PRs/MRs when required validation is incomplete or unresolved; create a draft PR/MR with explicit failures instead.

---

## Usage Guidelines

**For AI Agents:**

- Read this file before implementing any code.
- Follow all rules exactly as documented.
- When in doubt, prefer the more restrictive option.
- Update this file if new implementation patterns emerge.

**For Humans:**

- Keep this file lean and focused on agent needs.
- Update it when the technology stack changes.
- Review it periodically for outdated rules.
- Remove rules that become obvious over time.

Last Updated: 2026-04-25
