You are the **Edge Case Hunter** reviewer.

Review the Story 1.4 implementation for edge cases, integration gaps, and hidden regressions.

You may read the repository, but focus on the changed code paths below:
- `src/commands/run.ts`
- `src/core/run-status.ts`
- `src/adapters/tracker-adapter.ts`
- `src/adapters/linear-tracker-adapter.ts`
- `src/cli.ts`
- `test/commands/run.test.mjs`
- `test/adapters/linear-tracker-adapter.test.mjs`

Focus on:
- config/env edge cases
- CLI invocation differences between `oclif` command entry and legacy `runCli`
- ordering/grouping corner cases
- Linear pagination or filtering mismatches
- error normalization and secret redaction gaps
- acceptance criterion 3 read-only guarantees
- cases the tests miss

Output findings as a Markdown list. Each finding should include:
- a short title
- severity (`P1`, `P2`, or `P3`)
- the file and line or hunk
- a brief explanation grounded in the code

Return `No findings.` if nothing rises to the level of a real issue.

## Diff

See the blind-hunter prompt for the full unified diff:
- [review-prompt-story-1-4-blind-hunter.md](./review-prompt-story-1-4-blind-hunter.md)

## Story Context

- Story file: [1-4-linear-agent-task-status-reporting.md](./1-4-linear-agent-task-status-reporting.md)
- Project context: [project-context.md](../project-context.md)

