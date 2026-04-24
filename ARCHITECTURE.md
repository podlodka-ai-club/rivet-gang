# ARCHITECTURE.md

This document is the implementation-facing architecture summary for the project. It is intentionally shorter than the full BMAD architecture document and is meant to help AI agents and humans make consistent technical decisions.

For the complete decision log, see:
- [`_bmad-output/planning-artifacts/architecture.md`](./_bmad-output/planning-artifacts/architecture.md)

## System Overview

The project is a local-first TypeScript CLI agent that:
- selects one eligible task
- analyzes scope and safety
- creates or reuses a deterministic task branch
- applies a minimal scoped change
- runs validation and bounded repair attempts
- creates a draft or review-ready PR/MR
- leaves complete artifacts for operator and reviewer use

This is an MVP. It is not a distributed system, multi-agent runtime, or hosted platform.

## Architectural Goals

- deterministic execution
- clear AI-agent handoff
- minimal dependencies
- strict safety boundaries
- auditable outputs
- restart-safe progress persistence

## Collaboration Model

This project is built for AI agents and humans collaborating through GitHub, potentially from different machines.

The architecture separates:

- **shared durable coordination**
  - repo-tracked docs
  - branches
  - PRs/MRs
  - review comments

- **machine-local runtime state**
  - `.ai-agent/`
  - local checkpoints
  - local logs
  - machine-local locks

GitHub and repo-tracked documents are the collaboration plane.
`.ai-agent/` is the execution plane.

Another machine must not depend on resuming from a different machine's local `.ai-agent/` directory.
Cross-machine handoff should happen through repo-tracked execution plans and branch state.

## Explicit Non-Goals For MVP

- public HTTP API
- server deployment requirement
- database-backed state
- cache infrastructure
- event bus
- microservices
- remote control architecture
- concurrent worker orchestration

## Chosen Foundation

- Language: TypeScript
- Runtime: Node.js
- CLI framework: `oclif`
- Runtime model: single-process, local-first
- State model: filesystem under `.ai-agent/`
- Human artifacts: Markdown
- Machine state: JSON

## High-Level Components

- `commands`
  - CLI entrypoints only
  - expected commands: `init`, `doctor`, `run`

- `core`
  - workflow coordinator
  - decision gate
  - clarification logic
  - branch management
  - repair loop
  - self-review

- `adapters`
  - tracker adapter
  - VCS adapter
  - LLM adapter
  - validation adapter
  - secret-scan adapter

- `policy`
  - command allowlist
  - forbidden-path checks
  - scope and risk checks

- `state`
  - state persistence
  - artifact persistence
  - locks
  - path layout
  - checkpoints

## Runtime Data Layout

All runtime data lives under `.ai-agent/`.

Expected layout:

```text
.ai-agent/
  config.yaml
  state/
  tasks/
  logs/
  locks/
```

Required task artifacts:
- `research.md`
- `plan.md`
- `progress.json`
- `implementation.log`
- `test.md`
- `self-review.md`

These are runtime artifacts for one machine's execution context. They are not the default shared handoff mechanism between machines.

## Shared Coordination Documents

Shared execution coordination lives under `docs/exec-plans/`.

Expected layout:

```text
docs/
  exec-plans/
    README.md
    TEMPLATE.md
    active/
    completed/
```

Use `docs/exec-plans/active/*.md` for:
- current owner
- active branch
- durable scope decisions
- handoff notes
- current blockers

Use `docs/exec-plans/completed/*.md` for:
- finished work
- final outcome
- links to merged PRs/MRs or resulting commits

This keeps cross-machine coordination versioned, reviewable, and visible to all agents.

## Core Boundaries

### Commands

Commands must stay thin.

Allowed:
- parse CLI input
- load config
- call orchestrating services
- convert final workflow status to exit behavior

Not allowed:
- embedding workflow logic
- provider-specific logic
- direct artifact-shape decisions

### Core

Core owns:
- workflow orchestration
- decision making
- retry behavior
- resume logic
- typed workflow results

Core does not own:
- provider-specific payload parsing
- raw shell execution details
- filesystem layout policy

### Adapters

Adapters own:
- provider API calls
- command execution boundaries
- normalization of provider-specific payloads into internal models

Adapters do not own:
- workflow decisions
- policy decisions
- business rules

### Policy

Policy modules decide:
- whether a task is in scope
- whether paths are forbidden
- whether a command is allowed
- whether a change is unsafe or too large

Policy modules should return typed results, not perform broad side effects.

### State

State modules own:
- path conventions
- checkpoint writes
- artifact persistence
- lock management

State modules should not decide workflow outcomes.

## Required Internal Conventions

### Naming

- internal TypeScript models: `camelCase`
- JSON state keys: `camelCase`
- classes/types/interfaces: `PascalCase`
- constants: `UPPER_SNAKE_CASE` only for real constants
- timestamps: ISO 8601

### Workflow Results

Use discriminated unions with fixed statuses:

```ts
type WorkflowResult =
  | { status: "proceed"; ... }
  | { status: "blocked"; reason: string; ... }
  | { status: "needsClarification"; questions: string[]; ... }
  | { status: "refuseUnsafe"; reason: string; ... }
  | { status: "refuseTooLarge"; reason: string; ... };
```

### Persistence Rules

- persist checkpoints before duplicate-risk side effects
- keep JSON and Markdown responsibilities separate
- use deterministic artifact names
- prefer atomic writes where practical

## Security Model

- credentials come from explicitly configured environment variables
- arbitrary secret files must not be read
- secret values must not be logged
- secret values must not be sent to the LLM
- allowlist checks and forbidden-path checks must run before code edits and before PR/MR creation

## Testing Strategy

- tests grouped by architectural boundary
- adapter contract tests required
- fixtures under `test/fixtures/`
- avoid overbuilding test infrastructure before the module boundaries exist

## Dependency Policy

Prefer Node built-ins first:
- filesystem
- path handling
- process execution
- JSON serialization
- timing utilities

Add external dependencies only when:
- the PRD requires the capability
- the dependency replaces substantial custom code
- the dependency does not collapse architectural boundaries

## Implementation Order

1. CLI skeleton
2. config/env loading
3. state/artifact store
4. policy layer
5. adapter interfaces
6. coordinator and decision gate
7. validation runner
8. tracker and PR/MR integration

## Deferred Architecture

These are intentionally deferred until after MVP:
- remote client/server split
- concurrent workers
- database-backed state
- external telemetry stack
- container-first runtime

## Multi-Machine Constraint

The current MVP does **not** implement distributed runtime coordination.

That means:
- no shared lock service
- no remote checkpoint store
- no distributed queue
- no live multi-agent execution protocol

If true distributed execution is needed later, it should be introduced as a separate architectural evolution, not improvised inside the local-first MVP.

## Source Documents

- Requirements: [`PRD.md`](./PRD.md)
- Full architecture record: [`_bmad-output/planning-artifacts/architecture.md`](./_bmad-output/planning-artifacts/architecture.md)
- Agent working contract: [`AGENTS.md`](./AGENTS.md)
- Shared execution plans: [`docs/exec-plans/`](./docs/exec-plans/)
