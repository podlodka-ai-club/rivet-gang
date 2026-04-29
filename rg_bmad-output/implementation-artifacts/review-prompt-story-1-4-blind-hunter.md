You are the **Blind Hunter** reviewer.

Review the diff below adversarially. You get **diff only**. Do not assume any project context, spec intent, or hidden architecture rules beyond what is directly visible in the patch.

Focus on:
- correctness bugs
- broken CLI behavior
- output/exit-code mismatches
- pagination/query mistakes
- read-only guarantees that may not actually hold
- missing edge handling visible from the code

Output findings as a Markdown list. Each finding should include:
- a short title
- severity (`P1`, `P2`, or `P3`)
- the file and line or hunk
- a brief explanation grounded in the diff

Return `No findings.` if nothing rises to the level of a real issue.

## Diff

```diff
diff --git a/rg_bmad-output/implementation-artifacts/sprint-status.yaml b/rg_bmad-output/implementation-artifacts/sprint-status.yaml
index 8d83673..cfb0257 100644
--- a/rg_bmad-output/implementation-artifacts/sprint-status.yaml
+++ b/rg_bmad-output/implementation-artifacts/sprint-status.yaml
@@ -1,5 +1,5 @@
 # generated: 2026-04-25T14:35:08+0200
-# last_updated: 2026-04-25T18:55:41+0200
+# last_updated: 2026-04-25T19:20:54+0200
 # project: rivet-gang
 # project_key: NOKEY
 # tracking_system: file-system
@@ -35,7 +35,7 @@
 # - Dev moves story to 'review', then runs code-review (fresh context, different LLM recommended)
 
 generated: "2026-04-25T14:35:08+0200"
-last_updated: "2026-04-25T18:55:41+0200"
+last_updated: "2026-04-25T19:20:54+0200"
 project: rivet-gang
 project_key: NOKEY
 tracking_system: file-system
@@ -46,7 +46,7 @@ development_status:
   1-1-bootstrap-cli-and-linear-tracker-integration: done
   1-2-runtime-configuration-and-repository-instructions: done
   1-3-readiness-doctor-for-local-execution: done
-  1-4-linear-agent-task-status-reporting: backlog
+  1-4-linear-agent-task-status-reporting: review
   epic-1-retrospective: optional
 
   epic-2: backlog
diff --git a/src/adapters/linear-tracker-adapter.ts b/src/adapters/linear-tracker-adapter.ts
index 5101f43..8685845 100644
--- a/src/adapters/linear-tracker-adapter.ts
+++ b/src/adapters/linear-tracker-adapter.ts
@@ -1,4 +1,5 @@
 import type {
+  TrackerAgentIssueQuery,
   TrackerAdapter,
   TrackerComment,
   TrackerIssueQuery,
@@ -48,6 +49,72 @@ export class LinearTrackerAdapter implements TrackerAdapter {
     return { ok: true, value: undefined };
   }
 
+  async listAgentIssues(query: TrackerAgentIssueQuery): Promise<Result<TrackerIssue[], IntegrationError>> {
+    const issues: TrackerIssue[] = [];
+    let after: string | null = null;
+
+    do {
+      const result: Result<{
+        issues: {
+          nodes: LinearIssueNode[];
+          pageInfo: {
+            hasNextPage: boolean;
+            endCursor: string | null;
+          };
+        };
+      }, IntegrationError> = await this.graphql<{
+        issues: {
+          nodes: LinearIssueNode[];
+          pageInfo: {
+            hasNextPage: boolean;
+            endCursor: string | null;
+          };
+        };
+      }>(
+        `query AgentIssues($first: Int!, $after: String, $labelName: String!) {
+          issues(
+            first: $first,
+            after: $after,
+            orderBy: updatedAt,
+            filter: {
+              labels: { name: { eq: $labelName } }
+            }
+          ) {
+            nodes {
+              id
+              identifier
+              title
+              description
+              url
+              updatedAt
+              state { name }
+              labels { nodes { name } }
+            }
+            pageInfo {
+              hasNextPage
+              endCursor
+            }
+          }
+        }`,
+        { first: 50, after, labelName: query.eligibilityLabel }
+      );
+
+      if (!result.ok) {
+        return result;
+      }
+
+      issues.push(...result.value.issues.nodes.map(normalizeIssue));
+
+      if (!result.value.issues.pageInfo.hasNextPage || result.value.issues.pageInfo.endCursor === null) {
+        break;
+      }
+
+      after = result.value.issues.pageInfo.endCursor;
+    } while (after !== null);
+
+    return { ok: true, value: issues };
+  }
+
   async listEligibleIssues(query: TrackerIssueQuery): Promise<Result<TrackerIssue[], IntegrationError>> {
     const result = await this.graphql<{ issues: { nodes: LinearIssueNode[] } }>(
       `query EligibleIssues {
diff --git a/src/adapters/tracker-adapter.ts b/src/adapters/tracker-adapter.ts
index ac53d5e..8fc74d5 100644
--- a/src/adapters/tracker-adapter.ts
+++ b/src/adapters/tracker-adapter.ts
@@ -6,6 +6,10 @@ export type TrackerIssueQuery = {
   eligibilityLabel: string;
 };
 
+export type TrackerAgentIssueQuery = {
+  eligibilityLabel: string;
+};
+
 export type TrackerStatusUpdate = {
   issueId: string;
   statusName: string;
@@ -18,6 +22,7 @@ export type TrackerComment = {
 
 export interface TrackerAdapter {
   verifyAccess(): Promise<Result<void, IntegrationError>>;
+  listAgentIssues(query: TrackerAgentIssueQuery): Promise<Result<TrackerIssue[], IntegrationError>>;
   listEligibleIssues(query: TrackerIssueQuery): Promise<Result<TrackerIssue[], IntegrationError>>;
   updateStatus(update: TrackerStatusUpdate): Promise<Result<void, IntegrationError>>;
   addComment(comment: TrackerComment): Promise<Result<{ marker: string }, IntegrationError>>;
diff --git a/src/cli.ts b/src/cli.ts
index 95d6bcd..8ec8387 100644
--- a/src/cli.ts
+++ b/src/cli.ts
@@ -26,9 +26,11 @@ export async function runCli(io: CliIO): Promise<number> {
   }
 
   if (command === "run") {
-    const result = await runRunCommand();
+    const result = await runRunCommand(io.cwd, io.env, {
+      statusOnly: io.argv.includes("--status-only")
+    });
     io.stdout.write(`${result.message}\n`);
-    return 1;
+    return result.exitCode;
   }
 
   io.stderr.write("Usage: rg <init|doctor|run>\n");
diff --git a/src/commands/run.ts b/src/commands/run.ts
index 0b28dfb..6d21835 100644
--- a/src/commands/run.ts
+++ b/src/commands/run.ts
@@ -1,25 +1,68 @@
-import {Command} from "@oclif/core";
+import {Command, Flags} from "@oclif/core";
+import {runStatusOnly, type RunStatusOnlyOptions} from "../core/run-status.js";
+import type {FetchLike as LinearFetchLike} from "../adapters/linear-tracker-adapter.js";
 
-export type RunCommandResult = {
-  status: "blocked";
-  reason: "notImplemented";
-  message: string;
+export type RunCommandResult =
+  | {
+    status: "blocked";
+    reason: "notImplemented";
+    message: string;
+    exitCode: 1;
+  }
+  | {
+    status: "pass";
+    message: string;
+    exitCode: 0;
+  }
+  | {
+    status: "fail";
+    message: string;
+    exitCode: 1;
+  };
+
+export type RunCommandOptions = RunStatusOnlyOptions & {
+  statusOnly: boolean;
+  linearFetchFn?: LinearFetchLike;
 };
 
-export async function runRunCommand(): Promise<RunCommandResult> {
+export async function runRunCommand(
+  cwd: string,
+  env: NodeJS.ProcessEnv,
+  options: RunCommandOptions
+): Promise<RunCommandResult> {
+  if (options.statusOnly) {
+    return runStatusOnly(cwd, env, {
+      linearFetchFn: options.linearFetchFn
+    });
+  }
+
   return {
     status: "blocked",
     reason: "notImplemented",
-    message: "rg run command surface exists; task execution is implemented in later stories"
+    message: "rg run command surface exists; task execution is implemented in later stories",
+    exitCode: 1
   };
 }
 
+export function formatRunResult(result: RunCommandResult): string {
+  return result.message;
+}
+
 export default class RunCommand extends Command {
   static override description = "Run rg task automation";
 
+  static override flags = {
+    "status-only": Flags.boolean({
+      summary: "Report agent-owned Linear tasks without executing work"
+    })
+  };
+
   async run(): Promise<void> {
-    const result = await runRunCommand();
-    this.log(result.message);
-    this.exit(1);
+    const {flags} = await this.parse(RunCommand);
+    const result = await runRunCommand(process.cwd(), process.env, {
+      statusOnly: flags["status-only"]
+    });
+    this.log(formatRunResult(result));
+    this.exit(result.exitCode);
   }
 }
diff --git a/src/core/run-status.ts b/src/core/run-status.ts
new file mode 100644
index 0000000..ff29bd5
--- /dev/null
+++ b/src/core/run-status.ts
@@ -0,0 +1,100 @@
+import {LinearTrackerAdapter, type FetchLike as LinearFetchLike} from "../adapters/linear-tracker-adapter.js";
+import {loadRuntimeConfigValidation} from "../config/config.js";
+import {readEnv} from "../config/env.js";
+import type {TrackerIssue} from "../types/task.js";
+
+export type RunStatusOnlyResult =
+  | {status: "pass"; exitCode: 0; message: string}
+  | {status: "fail"; exitCode: 1; message: string};
+
+export type RunStatusOnlyOptions = {
+  linearFetchFn?: LinearFetchLike;
+};
+
+export async function runStatusOnly(
+  cwd: string,
+  env: NodeJS.ProcessEnv,
+  options: RunStatusOnlyOptions = {}
+): Promise<RunStatusOnlyResult> {
+  const configResult = await loadRuntimeConfigValidation(cwd);
+  if (configResult.status === "invalid") {
+    return {
+      status: "fail",
+      exitCode: 1,
+      message: `${configResult.issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")}. Fix: edit .ai-agent/config.yaml and rerun rg run --status-only.`
+    };
+  }
+
+  const token = readEnv(env, configResult.config.tracker.authEnv);
+  if (token.status === "missing") {
+    return {
+      status: "fail",
+      exitCode: 1,
+      message: `Missing required environment variable ${configResult.config.tracker.authEnv}. Fix: export ${configResult.config.tracker.authEnv}=<linear-api-key> or change tracker.authEnv in .ai-agent/config.yaml.`
+    };
+  }
+
+  const adapter = new LinearTrackerAdapter({
+    token: token.value,
+    fetchFn: options.linearFetchFn
+  });
+  const result = await adapter.listAgentIssues({
+    eligibilityLabel: configResult.config.tracker.eligibilityLabel
+  });
+
+  if (!result.ok) {
+    return {
+      status: "fail",
+      exitCode: 1,
+      message: `Linear status reporting failed: ${redact(result.error.message, [token.value])}. Fix: verify the Linear token, API access, and eligibility label.`
+    };
+  }
+
+  return {
+    status: "pass",
+    exitCode: 0,
+    message: formatStatusReport(result.value, configResult.config.tracker.eligibleStatuses, configResult.config.tracker.eligibilityLabel)
+  };
+}
+
+function formatStatusReport(issues: TrackerIssue[], eligibleStatuses: string[], eligibilityLabel: string): string {
+  if (issues.length === 0) {
+    return `No Linear issues found with label ${eligibilityLabel}.`;
+  }
+
+  const issuesByState = new Map<string, TrackerIssue[]>();
+  for (const issue of issues) {
+    const state = issue.state.trim() === "" ? "Unknown" : issue.state;
+    const existing = issuesByState.get(state) ?? [];
+    existing.push(issue);
+    issuesByState.set(state, existing);
+  }
+
+  const remainingStates = [...issuesByState.keys()]
+    .filter((state) => !eligibleStatuses.includes(state))
+    .sort((left, right) => left.localeCompare(right));
+  const orderedStates = [
+    ...eligibleStatuses.filter((state) => issuesByState.has(state)),
+    ...remainingStates
+  ];
+
+  const lines = [`Agent-owned Linear tasks for label ${eligibilityLabel}:`];
+  for (const state of orderedStates) {
+    const issuesForState = [...(issuesByState.get(state) ?? [])]
+      .sort((left, right) => left.identifier.localeCompare(right.identifier));
+    lines.push(`STATUS ${state}${eligibleStatuses.includes(state) ? " [eligible for pickup]" : ""}`);
+    for (const issue of issuesForState) {
+      lines.push(
+        issue.url === null
+          ? `- ${issue.identifier} | ${state} | ${issue.title}`
+          : `- ${issue.identifier} | ${state} | ${issue.title} | ${issue.url}`
+      );
+    }
+  }
+
+  return lines.join("\n");
+}
+
+function redact(message: string, secrets: string[]): string {
+  return secrets.reduce((current, secret) => secret === "" ? current : current.split(secret).join("[redacted]"), message);
+}
diff --git a/test/adapters/linear-tracker-adapter.test.mjs b/test/adapters/linear-tracker-adapter.test.mjs
index 3ca4175..920285c 100644
--- a/test/adapters/linear-tracker-adapter.test.mjs
+++ b/test/adapters/linear-tracker-adapter.test.mjs
@@ -100,6 +100,67 @@ test("Linear adapter adds stable marker to comments", async () => {
   assert.match(requestBody.variables.body, /Question\?/);
 });
 
+test("Linear adapter lists agent-labeled issues across statuses with pagination", async () => {
+  const bodies = [];
+  const adapter = new LinearTrackerAdapter({
+    token: "token",
+    fetchFn: async (_url, init) => {
+      const body = JSON.parse(init.body);
+      bodies.push(body);
+
+      if (!body.variables.after) {
+        return response({
+          data: {
+            issues: {
+              nodes: [
+                issue({id: "1", state: "To Do", labels: ["ai-agent"]}),
+                issue({id: "2", state: "In Progress", labels: ["ai-agent"]})
+              ],
+              pageInfo: {hasNextPage: true, endCursor: "cursor-2"}
+            }
+          }
+        });
+      }
+
+      return response({
+        data: {
+          issues: {
+            nodes: [
+              issue({id: "3", state: "Blocked", labels: ["ai-agent"]})
+            ],
+            pageInfo: {hasNextPage: false, endCursor: null}
+          }
+        }
+      });
+    }
+  });
+
+  const result = await adapter.listAgentIssues({
+    eligibilityLabel: "ai-agent"
+  });
+
+  assert.equal(result.ok, true);
+  assert.deepEqual(result.value.map((item) => item.providerId), ["1", "2", "3"]);
+  assert.equal(bodies[0].variables.labelName, "ai-agent");
+  assert.equal(bodies[1].variables.after, "cursor-2");
+});
+
+test("Linear adapter normalizes agent-issue query errors", async () => {
+  const adapter = new LinearTrackerAdapter({
+    token: "token",
+    fetchFn: async () => response({
+      errors: [{message: "Bad request"}]
+    })
+  });
+
+  const result = await adapter.listAgentIssues({
+    eligibilityLabel: "ai-agent"
+  });
+
+  assert.equal(result.ok, false);
+  assert.equal(result.error.code, "graphqlError");
+});
+
 function response(payload, ok = true, status = 200) {
   return {
     ok,
diff --git a/test/commands/run.test.mjs b/test/commands/run.test.mjs
new file mode 100644
index 0000000..5ef4334
--- /dev/null
+++ b/test/commands/run.test.mjs
@@ -0,0 +1,154 @@
+import assert from "node:assert/strict";
+import {mkdtemp, writeFile} from "node:fs/promises";
+import {tmpdir} from "node:os";
+import {join} from "node:path";
+import {test} from "node:test";
+import {defaultConfigYaml} from "../../dist/config/defaults.js";
+import {formatRunResult, runRunCommand} from "../../dist/commands/run.js";
+import {runInitCommand} from "../../dist/commands/init.js";
+
+test("rg run stays blocked when status-only mode is not requested", async () => {
+  const cwd = await mkdtemp(join(tmpdir(), "rg-run-blocked-"));
+  await runInitCommand(cwd);
+
+  const result = await runRunCommand(cwd, process.env, {statusOnly: false});
+
+  assert.equal(result.status, "blocked");
+  assert.equal(result.exitCode, 1);
+  assert.match(formatRunResult(result), /task execution is implemented in later stories/);
+});
+
+test("rg run --status-only reports agent tasks grouped by status and marks eligible pickup states", async () => {
+  const cwd = await mkdtemp(join(tmpdir(), "rg-run-status-"));
+  await writeFile(join(cwd, "AGENTS.md"), "# Test Instructions\n");
+  await runInitCommand(cwd);
+  await writeConfig(cwd, defaultConfigYaml);
+
+  const seenQueries = [];
+  const result = await runRunCommand(
+    cwd,
+    {GR_LINEAR_API_KEY: "super-secret-token"},
+    {
+      statusOnly: true,
+      linearFetchFn: async (_url, init) => {
+        const body = JSON.parse(init.body);
+        seenQueries.push(body.query);
+
+        return response({
+          data: {
+            issues: {
+              nodes: [
+                issue({id: "1", state: "To Do", title: "First task"}),
+                issue({id: "2", state: "In Progress", title: "Second task"}),
+                issue({id: "3", state: "To Do", title: "Third task", url: null})
+              ],
+              pageInfo: {hasNextPage: false, endCursor: null}
+            }
+          }
+        });
+      }
+    }
+  );
+  const output = formatRunResult(result);
+
+  assert.equal(result.status, "pass");
+  assert.equal(result.exitCode, 0);
+  assert.match(output, /STATUS To Do \[eligible for pickup\]/);
+  assert.match(output, /STATUS In Progress/);
+  assert.match(output, /RIV-1 \| To Do \| First task \| https:\/\/linear\.app\/example\/issue\/RIV-1/);
+  assert.match(output, /RIV-2 \| In Progress \| Second task \| https:\/\/linear\.app\/example\/issue\/RIV-2/);
+  assert.match(output, /RIV-3 \| To Do \| Third task$/m);
+  assert.doesNotMatch(output, /super-secret-token/);
+  assert.ok(seenQueries.every((query) => !query.includes("issueUpdate") && !query.includes("commentCreate")));
+});
+
+test("rg run --status-only reports when no agent tasks are found", async () => {
+  const cwd = await mkdtemp(join(tmpdir(), "rg-run-empty-"));
+  await runInitCommand(cwd);
+  await writeConfig(cwd, defaultConfigYaml);
+
+  const result = await runRunCommand(
+    cwd,
+    {GR_LINEAR_API_KEY: "super-secret-token"},
+    {
+      statusOnly: true,
+      linearFetchFn: async () => response({
+        data: {
+          issues: {
+            nodes: [],
+            pageInfo: {hasNextPage: false, endCursor: null}
+          }
+        }
+      })
+    }
+  );
+
+  assert.equal(result.status, "pass");
+  assert.equal(result.exitCode, 0);
+  assert.match(formatRunResult(result), /No Linear issues found with label ai-agent/);
+});
+
+test("rg run --status-only fails safely when Linear authentication is missing", async () => {
+  const cwd = await mkdtemp(join(tmpdir(), "rg-run-auth-missing-"));
+  await runInitCommand(cwd);
+  await writeConfig(cwd, defaultConfigYaml);
+
+  const result = await runRunCommand(cwd, {}, {statusOnly: true});
+  const output = formatRunResult(result);
+
+  assert.equal(result.status, "fail");
+  assert.equal(result.exitCode, 1);
+  assert.match(output, /Missing required environment variable GR_LINEAR_API_KEY/);
+});
+
+test("rg run --status-only fails safely on Linear API errors without leaking secrets", async () => {
+  const cwd = await mkdtemp(join(tmpdir(), "rg-run-api-fail-"));
+  await runInitCommand(cwd);
+  await writeConfig(cwd, defaultConfigYaml);
+
+  const result = await runRunCommand(
+    cwd,
+    {GR_LINEAR_API_KEY: "super-secret-token"},
+    {
+      statusOnly: true,
+      linearFetchFn: async () => response({
+        errors: [{message: "Authentication failed for super-secret-token"}]
+      })
+    }
+  );
+  const output = formatRunResult(result);
+
+  assert.equal(result.status, "fail");
+  assert.equal(result.exitCode, 1);
+  assert.match(output, /Linear status reporting failed/);
+  assert.doesNotMatch(output, /super-secret-token/);
+});
+
+async function writeConfig(cwd, text) {
+  await writeFile(join(cwd, ".ai-agent", "config.yaml"), text);
+}
+
+function response(payload, ok = true, status = 200) {
+  return {
+    ok,
+    status,
+    async json() {
+      return payload;
+    }
+  };
+}
+
+function issue({id, state, title, url = `https://linear.app/example/issue/RIV-${id}`}) {
+  return {
+    id,
+    identifier: `RIV-${id}`,
+    title,
+    description: null,
+    url,
+    updatedAt: "2026-04-25T12:00:00.000Z",
+    state: {name: state},
+    labels: {
+      nodes: [{name: "ai-agent"}]
+    }
+  };
+}
```
