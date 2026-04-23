# Execution Plans

This directory is the shared coordination layer for AI agents and humans working from different machines through GitHub.

Use it for durable, reviewable handoff state.

Do not use it for:
- transient logs
- local lock files
- raw provider payloads
- machine-specific runtime checkpoints

Those remain under `.ai-agent/`.

## Layout

```text
docs/exec-plans/
  README.md
  TEMPLATE.md
  active/
  completed/
```

## Rules

- Put active work in `active/`
- Put finished work in `completed/`
- One active task should have one canonical plan file
- Keep the plan file updated before handoff, pause, or context switch
- Store branch name, owner, status, and PR link in frontmatter

## Recommended Flow

1. Create a plan from `TEMPLATE.md`
2. Save it in `active/`
3. Update it as work progresses
4. Use it for cross-machine handoff
5. Move or rewrite it into `completed/` when done

## Relationship To Runtime State

Repo-tracked execution plans are the shared source of truth.

Local runtime state under `.ai-agent/` is:
- ephemeral
- machine-local
- not safe to assume across machines
