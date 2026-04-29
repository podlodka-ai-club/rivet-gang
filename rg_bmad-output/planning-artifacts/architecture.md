---
stepsCompleted:
  - 1
  - 2
  - 3
  - 4
  - 5
  - 6
  - 7
  - 8
inputDocuments:
  - '/Users/aifedorov/rivet-gang/PRD.md'
workflowType: 'architecture'
lastStep: 8
status: 'complete'
completedAt: '2026-04-23'
project_name: 'rivet-gang'
user_name: 'aifedorov'
date: '2026-04-23'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**
The PRD defines a CLI-driven automation system that initializes project runtime state, verifies environment readiness, executes either supervisor-mode or single-task workflows, filters eligible tasks, creates deterministic task branches, requests clarification when requirements are unclear, runs validation commands, applies bounded repair attempts, creates draft or review-ready PRs/MRs, and produces review artifacts. Architecturally, this implies a workflow coordinator, integration adapters, validation runner, artifact/state store, and policy enforcement layer.

**Non-Functional Requirements:**
The architecture must support median pickup-to-PR turnaround within 30 minutes on the pilot repository, visible per-task cost tracking, zero secret leakage, restart-safe execution without duplicate side effects, complete artifact generation for every completed or blocked run, machine-readable run-state recording, unrelated-file-change discipline, and measurable repair-loop convergence. These requirements will drive state persistence, observability, failure recovery, and security boundaries.

**Scale & Complexity:**
This is a medium-complexity CLI automation product. It has no frontend delivery complexity, but it has meaningful orchestration complexity because it coordinates multiple external systems, persists resumable state, and must produce deterministic outputs for human review.

- Primary domain: CLI orchestration and automation backend
- Complexity level: Medium
- Estimated architectural components: 6-8 core components

### Technical Constraints & Dependencies

The system is constrained to one repository, one task tracker, one VCS/code host, one LLM provider, and one task at a time. Supervisor mode is sequential only. The implementation must avoid forbidden paths, dependency changes, CI/CD changes, and sensitive auth/payment/PII changes. The architecture depends on reliable local execution of configured validation commands, deterministic branch naming, task-artifact persistence, and integration credentials for tracker, VCS, and LLM services.

### Cross-Cutting Concerns Identified

- Idempotent task execution and duplicate-side-effect prevention
- Persistent state and restart-safe resume behavior
- Secret protection and command allowlisting
- Validation orchestration with bounded repair attempts
- Artifact generation for operator and reviewer trust
- Policy enforcement for scope, forbidden paths, and unsafe tasks
- Integration reliability and blocked-state handling

## Starter Template Evaluation

### Primary Technology Domain

CLI orchestration / automation backend based on project requirements analysis

### Starter Options Considered

**oclif**
Best fit for a structured TypeScript CLI with multiple commands, packaged bin scripts, and official scaffolding.

**commander**
Viable for a smaller hand-rolled CLI, but leaves more architectural setup undefined.

**opencode as reference**
Useful as a reference architecture for a mature coding-agent product, but too broad and opinionated as an MVP starter because it brings monorepo, Bun, client/server, desktop, and richer infrastructure assumptions.

### Selected Starter: oclif

**Rationale for Selection:**
This project needs a real CLI application structure, but the MVP should keep dependencies and architectural commitments minimal. oclif gives us command scaffolding and CLI conventions without forcing a large platform footprint.

**Initialization Command:**

```bash
npx oclif generate rivet-agent --yes
```

**Architectural Decisions Provided by Starter:**

**Language & Runtime:**
TypeScript on Node.js with oclif command structure.

**Dependency Strategy:**
Minimal dependencies by default. Prefer Node built-ins for filesystem, process execution, path handling, and JSON state management. Add libraries only when justified by a specific requirement.

**Styling Solution:**
None. Terminal output only.

**Build Tooling:**
oclif-generated CLI package and bin scripts.

**Testing Framework:**
Use the lightweight testing setup that comes with the generated CLI or add only the minimum required test tooling later.

**Code Organization:**
Command-oriented layout aligned to `init`, `doctor`, and `run`.

**Development Experience:**
Generated CLI structure, TypeScript-friendly setup, and low initial complexity.

**Note:** Project initialization using this command should be the first implementation story.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
- Use filesystem-based runtime state and artifacts under `.ai-agent/`
- Use adapter boundaries for tracker, VCS, and LLM integrations
- Enforce env-var-based secret loading, command allowlisting, and forbidden-path protections
- Keep MVP as a local-first single-process CLI with no required server deployment

**Important Decisions (Shape Architecture):**
- Use JSON for machine-readable state and Markdown for human-readable artifacts
- Avoid database and cache infrastructure in MVP
- Use typed internal service boundaries rather than direct command-to-provider coupling
- Use machine-readable error categories for `blocked`, `refuse_unsafe`, `refuse_too_large`, and `needs_clarification`

**Deferred Decisions (Post-MVP):**
- Remote control or client/server split
- Multi-task concurrency
- Database-backed state
- External telemetry platform
- Container-first deployment

### Data Architecture

- Runtime state is stored under `.ai-agent/`
- Human-readable artifacts use Markdown
- Machine-readable state uses JSON
- No database is used in MVP
- No migration system is required in MVP
- No separate cache layer is introduced in MVP

### Authentication & Security

- Credentials are supplied through explicitly configured environment variables
- No end-user authentication system is included in MVP
- Secret values must never be written to logs or sent to the LLM
- Commands are limited to a configured allowlist
- Forbidden-path checks run before code changes and before PR/MR creation

### API & Communication Patterns

- MVP uses no external HTTP API as a required architectural component
- Internal boundaries are in-process modules/services
- Core adapter interfaces: tracker, VCS, LLM, validation
- Error handling uses typed categories and machine-readable result states

### Infrastructure & Deployment

- Primary runtime target is a local operator machine
- Distribution target is a CLI package
- Docker support is deferred
- CI/CD architecture is out of scope for MVP
- Observability is satisfied through task-local logs and artifacts

### Decision Impact Analysis

**Implementation Sequence:**
1. CLI command skeleton
2. Local state/artifact store
3. Policy and safety guard layer
4. Provider adapter interfaces
5. Workflow coordinator
6. Validation runner
7. PR/MR and tracker integration

**Cross-Component Dependencies:**
- Workflow coordinator depends on provider adapters, state store, and policy guards
- Validation runner depends on command allowlisting and artifact recording
- Provider adapters depend on env-var credential loading and typed error handling
- Reviewer-facing outputs depend on artifact completeness and deterministic workflow state

## Implementation Patterns & Consistency Rules

### Pattern Categories Defined

**Critical Conflict Points Identified:**
8 areas where AI agents could make different choices

### Naming Patterns

**Database Naming Conventions:**
No database naming conventions are defined for MVP because the system uses filesystem state only.

**API Naming Conventions:**
No public HTTP API conventions are defined for MVP.
If internal provider payloads are represented as TypeScript objects, external field names should be preserved as returned by the provider, while internal normalized models should use `camelCase`.

**Code Naming Conventions:**
- Command classes: `InitCommand`, `DoctorCommand`, `RunCommand`
- Command files: `init.ts`, `doctor.ts`, `run.ts`
- Service files: `coordinator.ts`, `validation-runner.ts`, `policy-guard.ts`
- Adapter files: `tracker-adapter.ts`, `vcs-adapter.ts`, `llm-adapter.ts`
- Types/interfaces: `PascalCase`
- Functions/variables: `camelCase`
- Constants: `UPPER_SNAKE_CASE` only for true constants
- JSON state keys: `camelCase`

### Structure Patterns

**Project Organization:**
- `src/commands/` contains only CLI entry commands
- `src/core/` contains workflow orchestration and domain logic
- `src/adapters/` contains tracker, VCS, LLM, and validation adapters
- `src/policy/` contains allowlist, forbidden-path, and safety checks
- `src/state/` contains runtime state and artifact persistence logic
- `src/types/` contains shared domain and integration types
- `test/` contains tests grouped by module or workflow behavior

**File Structure Patterns:**
- Co-locate closely related helper files only within the same module boundary
- Avoid generic `utils.ts` dump files
- Keep config parsing in one dedicated module
- Keep filesystem path conventions centralized in one state-paths module

### Format Patterns

**API Response Formats:**
No public API response wrapper is defined for MVP.
Internal operation results must use explicit discriminated unions such as:
- `{ status: "proceed", ... }`
- `{ status: "blocked", reason: ... }`
- `{ status: "needsClarification", questions: [...] }`
- `{ status: "refuseUnsafe", reason: ... }`
- `{ status: "refuseTooLarge", reason: ... }`

**Data Exchange Formats:**
- JSON state files use `camelCase`
- Dates/timestamps use ISO 8601 strings
- Booleans use `true/false`
- Null is preferred over sentinel string values
- Lists remain arrays even when they contain one item
- Artifact file names follow the PRD exactly

### Communication Patterns

**Event System Patterns:**
No asynchronous event bus is defined for MVP.
Cross-module communication happens through direct in-process service calls with typed interfaces.

**State Management Patterns:**
- State updates must be explicit read-modify-write operations
- Each workflow stage writes a persisted checkpoint before side effects that could be duplicated
- File writes should be atomic where practical
- State transitions use a constrained stage enum rather than free-form strings

### Process Patterns

**Error Handling Patterns:**
- Domain errors are categorized by workflow outcome and machine-readable reason
- Unexpected exceptions are logged separately from user-facing blocked/refusal reasons
- Provider failures must be normalized into typed integration errors
- Commands return deterministic exit behavior based on final workflow status

**Loading State Patterns:**
- No UI loading-state system is needed for MVP
- Long-running work is surfaced through persisted stage updates in `progress.json`
- Console output should summarize current stage, not replace persisted state

### Enforcement Guidelines

**All AI Agents MUST:**
- write machine-readable state only in JSON files under `.ai-agent/`
- write human-readable artifacts only in the documented Markdown artifact files
- preserve `camelCase` for internal TypeScript and JSON models
- keep command modules thin and move workflow logic into core services
- normalize provider-specific responses before they enter core workflow logic
- run safety checks before file edits and before PR/MR creation
- avoid introducing new infrastructure or dependencies unless the PRD requires them

**Pattern Enforcement:**
- Review architecture and PRD conformance during self-review
- Flag pattern violations in `self-review.md`
- Update architecture rules before adopting a new conflicting pattern
- Reject opportunistic abstractions that collapse module boundaries

### Pattern Examples

**Good Examples:**
- `src/commands/run.ts` calls a coordinator service instead of implementing workflow logic inline
- `progress.json` stores `currentStage`, `decision`, `repairAttemptCount`, and `lastError` in `camelCase`
- `src/adapters/github-vcs-adapter.ts` maps GitHub-specific payloads into internal typed models before returning them

**Anti-Patterns:**
- putting branching, validation, and PR creation logic directly inside an oclif command file
- mixing provider response shapes directly into core workflow logic
- introducing a database or cache for MVP state without a PRD-driven reason
- creating shared `helpers.ts` or `utils.ts` dumping grounds across unrelated modules
- storing timestamps in inconsistent formats across artifacts

## Project Structure & Boundaries

### Complete Project Directory Structure

```text
rivet-agent/
├── README.md
├── package.json
├── tsconfig.json
├── .gitignore
├── .env.example
├── bin/
│   ├── dev.js
│   ├── dev.cmd
│   ├── run.js
│   └── run.cmd
├── src/
│   ├── index.ts
│   ├── commands/
│   │   ├── init.ts
│   │   ├── doctor.ts
│   │   └── run.ts
│   ├── core/
│   │   ├── coordinator.ts
│   │   ├── decision-gate.ts
│   │   ├── clarification.ts
│   │   ├── branch-manager.ts
│   │   ├── repair-loop.ts
│   │   ├── self-review.ts
│   │   └── workflow-status.ts
│   ├── adapters/
│   │   ├── tracker-adapter.ts
│   │   ├── vcs-adapter.ts
│   │   ├── llm-adapter.ts
│   │   ├── validation-adapter.ts
│   │   └── secret-scan-adapter.ts
│   ├── policy/
│   │   ├── allowlist-policy.ts
│   │   ├── forbidden-path-policy.ts
│   │   ├── scope-policy.ts
│   │   └── risk-policy.ts
│   ├── state/
│   │   ├── state-store.ts
│   │   ├── artifact-store.ts
│   │   ├── lock-store.ts
│   │   ├── path-layout.ts
│   │   └── checkpoint.ts
│   ├── config/
│   │   ├── config.ts
│   │   ├── env.ts
│   │   └── defaults.ts
│   ├── types/
│   │   ├── task.ts
│   │   ├── workflow.ts
│   │   ├── results.ts
│   │   ├── artifacts.ts
│   │   ├── provider.ts
│   │   └── errors.ts
│   └── util/
│       ├── fs.ts
│       ├── process.ts
│       ├── time.ts
│       └── serialization.ts
├── test/
│   ├── commands/
│   │   ├── init.test.ts
│   │   ├── doctor.test.ts
│   │   └── run.test.ts
│   ├── core/
│   │   ├── decision-gate.test.ts
│   │   ├── repair-loop.test.ts
│   │   └── coordinator.test.ts
│   ├── policy/
│   │   ├── forbidden-path-policy.test.ts
│   │   └── scope-policy.test.ts
│   ├── state/
│   │   └── state-store.test.ts
│   ├── adapters/
│   │   └── provider-contracts.test.ts
│   └── fixtures/
│       ├── tasks/
│       ├── repo-state/
│       └── config/
├── docs/
│   └── architecture.md
└── .ai-agent/
    ├── config.yaml
    ├── state/
    ├── tasks/
    ├── logs/
    └── locks/
```

### Architectural Boundaries

**API Boundaries:**
- No public HTTP API in MVP
- CLI commands are the only public entrypoints
- External provider boundaries are isolated behind typed adapters

**Component Boundaries:**
- `src/commands/` parses CLI input and delegates only
- `src/core/` owns workflow rules and orchestration
- `src/adapters/` owns provider-specific logic only
- `src/policy/` owns safety and scope rules only
- `src/state/` owns persistence and artifact layout only

**Service Boundaries:**
- Coordinator orchestrates but does not implement provider specifics
- Adapters never write workflow decisions directly
- Policy modules return typed decisions, not side effects
- State modules persist data but do not decide workflow behavior

**Data Boundaries:**
- Persistent runtime data lives only under `.ai-agent/`
- Machine-readable state is JSON
- Human-readable artifacts are Markdown
- Provider payloads are normalized before entering core logic

### Requirements to Structure Mapping

**Feature/Requirement Mapping:**
- `rg init` → `src/commands/init.ts`, `src/config/`, `src/state/path-layout.ts`
- `rg doctor` → `src/commands/doctor.ts`, `src/adapters/`, `src/config/env.ts`
- `rg run` → `src/commands/run.ts`, `src/core/coordinator.ts`
- Decision gate → `src/core/decision-gate.ts`
- Clarification flow → `src/core/clarification.ts`, `src/adapters/tracker-adapter.ts`
- Branch handling → `src/core/branch-manager.ts`, `src/adapters/vcs-adapter.ts`
- Validation and repair → `src/adapters/validation-adapter.ts`, `src/core/repair-loop.ts`
- Self-review → `src/core/self-review.ts`
- Restart safety and idempotency → `src/state/`, `src/core/workflow-status.ts`
- Safety controls → `src/policy/`

**Cross-Cutting Concerns:**
- Secret safety → `src/config/env.ts`, `src/policy/allowlist-policy.ts`
- Forbidden paths → `src/policy/forbidden-path-policy.ts`
- Artifact completeness → `src/state/artifact-store.ts`
- Typed result handling → `src/types/results.ts`
- Logging and timestamps → `src/util/time.ts`, `src/state/checkpoint.ts`

### Integration Points

**Internal Communication:**
- Commands call core services
- Core services call adapters, policy modules, and state store
- Adapters return normalized typed results to core
- State store persists checkpoints before and after sensitive side effects

**External Integrations:**
- Tracker integration enters only through `tracker-adapter.ts`
- VCS/PR integration enters only through `vcs-adapter.ts`
- LLM integration enters only through `llm-adapter.ts`
- Validation command execution enters only through validation adapters

**Data Flow:**
- CLI input → command → coordinator
- coordinator → decision gate / policy checks
- coordinator → adapters for read/write external interactions
- coordinator → state/artifact persistence
- persisted outputs → reviewer/operator artifacts

### File Organization Patterns

**Configuration Files:**
- Runtime config parsing stays in `src/config/`
- Example env values live in `.env.example`
- Default limits and forbidden paths live in `src/config/defaults.ts`

**Source Organization:**
- No business logic in `src/commands/`
- No provider-specific code in `src/core/`
- No cross-module dumping ground utils beyond focused helpers in `src/util/`

**Test Organization:**
- Tests grouped by architectural boundary
- Fixtures stored centrally under `test/fixtures/`
- Contract tests cover adapter normalization and typed result behavior

**Asset Organization:**
- No frontend asset tree in MVP
- Generated runtime artifacts belong only in `.ai-agent/`

### Development Workflow Integration

**Development Server Structure:**
- Local CLI development uses oclif bin scripts
- No persistent server process required for MVP

**Build Process Structure:**
- Build outputs package the CLI entrypoints and source modules
- Runtime artifact directories remain outside distributable source

**Deployment Structure:**
- Structure supports local install and local execution first
- Containerization can wrap the CLI later without restructuring core modules

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility:**
The selected stack is internally coherent. TypeScript, Node.js, oclif, local-file persistence, and a single-process runtime support the PRD without introducing unnecessary infrastructure. The architecture avoids contradictions between workflow orchestration, persistence, security rules, and integration boundaries.

**Pattern Consistency:**
The implementation patterns support the architectural decisions. Thin command modules, typed adapters, centralized policy checks, JSON state, Markdown artifacts, and `camelCase` internal models all align with the chosen stack and with the requirement that multiple AI agents implement consistently.

**Structure Alignment:**
The project structure supports the architecture directly. Core workflow logic, provider adapters, policy checks, persistence, configuration, and shared types are separated into explicit boundaries that reduce implementation drift across AI agents.

### Requirements Coverage Validation ✅

**Epic/Feature Coverage:**
No epics were provided, so validation was performed against the PRD requirement set and workflow scenarios.

**Functional Requirements Coverage:**
All functional requirement groups are architecturally supported:
- command lifecycle through `src/commands/`
- workflow orchestration through `src/core/`
- provider integrations through `src/adapters/`
- safety and scope enforcement through `src/policy/`
- persistence and artifacts through `src/state/`

**Non-Functional Requirements Coverage:**
The architecture addresses the key NFRs:
- restart safety through checkpoints and persisted state
- artifact completeness through dedicated artifact persistence
- secret safety through env-var-based credential boundaries
- reviewability through deterministic outputs and structured artifacts
- local-first execution through single-process CLI structure

### Implementation Readiness Validation ✅

**Decision Completeness:**
Critical decisions are documented clearly enough for implementation to begin without re-deciding core foundations.

**Structure Completeness:**
The project tree is specific and implementation-oriented rather than generic. Major files, directories, and boundaries are defined.

**Pattern Completeness:**
The main agent-conflict zones are covered: naming, structure, result formats, persistence rules, module boundaries, and process consistency.

### Gap Analysis Results

**Critical Gaps:**
None.

**Important Gaps:**
- `progress.json` schema is implied but not fully enumerated as a formal contract
- adapter contract-test expectations could be documented more explicitly

**Nice-to-Have Gaps:**
- add a canonical example for discriminated union workflow results
- add sample artifact file contents for test fixtures

### Validation Issues Addressed

No blocking validation issues were found. The architecture is internally coherent and suitable for AI-agent-driven implementation.

### Architecture Completeness Checklist

**✅ Requirements Analysis**
- [x] Project context thoroughly analyzed
- [x] Scale and complexity assessed
- [x] Technical constraints identified
- [x] Cross-cutting concerns mapped

**✅ Architectural Decisions**
- [x] Critical decisions documented
- [x] Technology stack fully specified
- [x] Integration patterns defined
- [x] Security and runtime constraints addressed

**✅ Implementation Patterns**
- [x] Naming conventions established
- [x] Structure patterns defined
- [x] Communication patterns specified
- [x] Process patterns documented

**✅ Project Structure**
- [x] Complete directory structure defined
- [x] Component boundaries established
- [x] Integration points mapped
- [x] Requirements-to-structure mapping completed

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION

**Confidence Level:** High

**Key Strengths:**
- Strong alignment with PRD scope
- Low infrastructure complexity for MVP
- Explicit boundaries that support multi-agent implementation
- Good consistency rules for preventing architectural drift

**Areas for Future Enhancement:**
- Formal JSON schema definitions for persisted state
- Stronger adapter contract fixtures
- Optional remote/runtime split after MVP if product scope expands

### Implementation Handoff

**AI Agent Guidelines:**
- Follow architectural boundaries exactly
- Keep command files thin
- Normalize provider payloads before core usage
- Persist checkpoints before duplicate-risk side effects
- Keep internal models and JSON state in `camelCase`
- Do not add infrastructure or dependencies without PRD-driven justification

**First Implementation Priority:**
Initialize the project with the selected oclif starter and establish the base module skeleton for commands, core workflow, adapters, policy, state, config, and types.
