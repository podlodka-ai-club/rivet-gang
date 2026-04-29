# AGENTS.md

This repository is intended to be developed by AI coding agents as well as humans. Treat this file as the operational contract for implementation work.

## Read This First

This file is intentionally short. Use it as the operating contract, not as the full design history.

Primary references:
- requirements: [`PRD.md`](./PRD.md)
- architecture summary: [`ARCHITECTURE.md`](./ARCHITECTURE.md)
- full decision log: [`rg_bmad-output/planning-artifacts/architecture.md`](./rg_bmad-output/planning-artifacts/architecture.md)
- shared execution plans: [`docs/exec-plans/`](./docs/exec-plans/)

## Mission

Build a local-first TypeScript CLI agent that:
- picks one eligible engineering task
- analyzes and gates it safely
- applies a minimal scoped change
- runs validation
- creates a reviewable PR/MR
- produces auditable task artifacts

## Current Architecture Constraints

- Runtime: Node.js + TypeScript
- CLI framework: `oclif`
- Runtime model: single-process, local-first
- State model: local filesystem only
- Public API: none in MVP
- Database/cache: none in MVP
- Dependency policy: minimal dependencies by default

Do not introduce:
- databases
- cache layers
- server components
- microservices
- background workers
- remote orchestration
- CI/CD changes
- dependency upgrades unrelated to the active task

If any of those become necessary, update `ARCHITECTURE.md` first.

## Shared vs Local State

This repository supports collaboration between AI agents working on different machines through GitHub and repo-tracked documents, not through shared runtime state.

### Shared Through GitHub / Repo

- source code and branches
- PRs/MRs and review comments
- issue/task discussion
- `PRD.md`
- `ARCHITECTURE.md`
- `docs/exec-plans/active/*.md`
- `docs/exec-plans/completed/*.md`

### Local To One Machine

- `.ai-agent/state/`
- `.ai-agent/tasks/`
- `.ai-agent/logs/`
- `.ai-agent/locks/`
- temporary local execution artifacts not promoted into repo docs

Rule:
- treat `.ai-agent/` as ephemeral runtime state
- treat repo docs as the durable source of truth for cross-machine handoff

## Multi-Agent Handoff Rules

When a task is non-trivial or may move between agents or machines:

1. Create or update a plan in `docs/exec-plans/active/`
2. Record the owning branch and current owner in the plan frontmatter
3. Put durable scope decisions, status, and handoff notes in that plan file
4. Do not assume another machine can resume from your local `.ai-agent/`
5. When work is finished, move or rewrite the plan into `docs/exec-plans/completed/`

Execution-plan frontmatter should include at minimum:

```yaml
task: TASK-ID
branch: branch-name
status: todo|in_progress|blocked|in_review|done
owner: agent-or-human
updatedAt: 2026-04-23T12:34:56Z
pr: null
```

Local lock files are machine-local only. They are not a distributed coordination mechanism.

## Module Boundaries

Keep boundaries strict.

- `src/commands/`: CLI entrypoints only. Parse input, call services, exit.
- `src/core/`: workflow orchestration and domain logic.
- `src/adapters/`: provider-specific integrations only.
- `src/policy/`: allowlist, forbidden-path, scope, and risk checks.
- `src/state/`: persistence, artifacts, checkpoints, path layout.
- `src/config/`: config loading, env parsing, defaults.
- `src/types/`: shared contracts, results, errors, artifacts.
- `src/util/`: focused helpers only.

Do not:
- put workflow logic in command files
- mix provider payload shapes into core logic
- let adapters make workflow decisions
- create generic dumping grounds like `utils.ts` or `helpers.ts`

## Required Consistency Rules

### Naming

- Files: kebab-case where appropriate, command files named by command (`init.ts`, `doctor.ts`, `run.ts`)
- Types/interfaces/classes: `PascalCase`
- Functions/variables: `camelCase`
- JSON keys: `camelCase`
- Timestamps: ISO 8601 strings

### Result Shapes

Use explicit discriminated unions for workflow outcomes. Prefer shapes like:

```ts
{ status: "proceed", ... }
{ status: "blocked", reason: ... }
{ status: "needsClarification", questions: [...] }
{ status: "refuseUnsafe", reason: ... }
{ status: "refuseTooLarge", reason: ... }
```

Do not invent alternate status names without updating architecture docs.

### Persistence

- Machine-readable state lives under `.ai-agent/` as JSON
- Human-readable artifacts are Markdown
- Persist checkpoints before side effects that could be duplicated
- Keep artifact file names aligned with the PRD and architecture
- Promote cross-machine handoff information into repo-tracked execution plans, not local runtime files

### Provider Boundaries

- Normalize external payloads inside adapters before returning to core
- Preserve provider-specific details inside adapters only
- Use typed adapter interfaces for tracker, VCS, LLM, validation, and secret scan

### Security

- Credentials come only from explicitly configured environment variables
- Never read arbitrary secret files
- Never send secret values to logs or the LLM
- Run allowlist and forbidden-path checks before file edits and before PR/MR creation

## Implementation Priorities

Build in this order unless a task explicitly says otherwise:

1. CLI command skeleton
2. Config/env loading
3. Local state and artifact store
4. Policy and safety guard layer
5. Provider adapter interfaces
6. Workflow coordinator and decision gate
7. Validation runner and repair loop
8. PR/MR and tracker integration

## Testing Expectations

- Group tests by architectural boundary under `test/`
- Add contract-style tests for adapters
- Prefer small focused tests over broad integration scaffolding unless the task needs it
- Keep fixtures under `test/fixtures/`

## Git and Change Discipline

- Keep diffs minimal and scoped
- Do not make opportunistic refactors
- Do not touch forbidden paths
- Do not change dependencies without explicit need
- Do not commit or push unless explicitly asked
- If work may be resumed elsewhere, update the execution plan before stopping

## Decision Rule

If two reasonable implementations exist, choose the one that:

1. preserves architectural boundaries
2. is easier for another AI agent to continue
3. adds fewer dependencies
4. produces more deterministic artifacts and state

## Reference Documents

- Root architecture summary: [`ARCHITECTURE.md`](./ARCHITECTURE.md)
- Full BMAD architecture record: [`rg_bmad-output/planning-artifacts/architecture.md`](./rg_bmad-output/planning-artifacts/architecture.md)
- Product requirements: [`PRD.md`](./PRD.md)
- Shared execution plans: [`docs/exec-plans/`](./docs/exec-plans/)
