import assert from "node:assert/strict";
import {mkdtemp, mkdir, readdir, readFile, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {test} from "node:test";
import {defaultConfigYaml} from "../../dist/config/defaults.js";
import {formatRunResult, runRunCommand} from "../../dist/commands/run.js";
import {runInitCommand} from "../../dist/commands/init.js";

test("rg run stays blocked when status-only mode is not requested", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "rg-run-blocked-"));
  await runInitCommand(cwd);

  const result = await runRunCommand(cwd, process.env, {statusOnly: false});

  assert.equal(result.status, "blocked");
  assert.equal(result.exitCode, 1);
  assert.match(formatRunResult(result), /task execution is implemented in later stories/);
});

test("rg run --status-only reports agent tasks grouped by status and marks eligible pickup states", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "rg-run-status-"));
  await writeFile(join(cwd, "AGENTS.md"), "# Test Instructions\n");
  await runInitCommand(cwd);
  await writeConfig(cwd, defaultConfigYaml);
  await mkdir(join(cwd, ".git", "refs", "heads"), {recursive: true});
  await writeFile(join(cwd, ".git", "HEAD"), "ref: refs/heads/main\n");
  await writeFile(join(cwd, ".git", "refs", "heads", "main"), "0123456789012345678901234567890123456789\n");
  const beforeSnapshot = await snapshotFiles(cwd);

  const seenQueries = [];
  let globalFetchCalls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    globalFetchCalls += 1;
    throw new Error("unexpected global fetch");
  };

  let result;
  try {
    result = await runRunCommand(
      cwd,
      {GR_LINEAR_API_KEY: "super-secret-token"},
      {
        statusOnly: true,
        linearFetchFn: async (_url, init) => {
          const body = JSON.parse(init.body);
          seenQueries.push(body.query);

          return response({
            data: {
              issues: {
                nodes: [
                  issue({id: "1", state: "To Do", title: "First task"}),
                  issue({id: "2", state: "In Progress", title: "Second task"}),
                  issue({id: "3", state: "To Do", title: "Third task", url: null})
                ],
                pageInfo: {hasNextPage: false, endCursor: null}
              }
            }
          });
        }
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
  const output = formatRunResult(result);
  const afterSnapshot = await snapshotFiles(cwd);

  assert.equal(result.status, "pass");
  assert.equal(result.exitCode, 0);
  assert.match(output, /STATUS To Do \[eligible for pickup\]/);
  assert.match(output, /STATUS In Progress/);
  assert.match(output, /RIV-1 \| To Do \| First task \| https:\/\/linear\.app\/example\/issue\/RIV-1/);
  assert.match(output, /RIV-2 \| In Progress \| Second task \| https:\/\/linear\.app\/example\/issue\/RIV-2/);
  assert.match(output, /RIV-3 \| To Do \| Third task$/m);
  assert.doesNotMatch(output, /super-secret-token/);
  assert.equal(globalFetchCalls, 0);
  assert.equal(seenQueries.length, 1);
  assert.ok(seenQueries.every((query) => !query.includes("issueUpdate") && !query.includes("commentCreate")));
  assert.deepEqual(afterSnapshot, beforeSnapshot);
});

test("rg run --status-only reports when no agent tasks are found", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "rg-run-empty-"));
  await runInitCommand(cwd);
  await writeConfig(cwd, defaultConfigYaml);

  const result = await runRunCommand(
    cwd,
    {GR_LINEAR_API_KEY: "super-secret-token"},
    {
      statusOnly: true,
      linearFetchFn: async () => response({
        data: {
          issues: {
            nodes: [],
            pageInfo: {hasNextPage: false, endCursor: null}
          }
        }
      })
    }
  );

  assert.equal(result.status, "pass");
  assert.equal(result.exitCode, 0);
  assert.match(formatRunResult(result), /No Linear issues found with label ai-agent/);
});

test("rg run --status-only fails safely when Linear authentication is missing", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "rg-run-auth-missing-"));
  await runInitCommand(cwd);
  await writeConfig(cwd, defaultConfigYaml);

  const result = await runRunCommand(cwd, {}, {statusOnly: true});
  const output = formatRunResult(result);

  assert.equal(result.status, "fail");
  assert.equal(result.exitCode, 1);
  assert.match(output, /Missing required environment variable GR_LINEAR_API_KEY/);
});

test("rg run --status-only ignores unrelated config validation errors", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "rg-run-unrelated-config-"));
  await runInitCommand(cwd);
  await writeConfig(cwd, defaultConfigYaml.replace("https://api.openai.com/v1", "not-a-url"));

  const result = await runRunCommand(
    cwd,
    {GR_LINEAR_API_KEY: "super-secret-token"},
    {
      statusOnly: true,
      linearFetchFn: async () => response({
        data: {
          issues: {
            nodes: [],
            pageInfo: {hasNextPage: false, endCursor: null}
          }
        }
      })
    }
  );

  assert.equal(result.status, "pass");
  assert.equal(result.exitCode, 0);
});

test("rg run --status-only does not echo unsafe tracker auth config values", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "rg-run-authenv-redaction-"));
  await runInitCommand(cwd);
  await writeConfig(cwd, defaultConfigYaml.replace("GR_LINEAR_API_KEY", "super-secret-token"));

  const result = await runRunCommand(cwd, {}, {statusOnly: true});
  const output = formatRunResult(result);

  assert.equal(result.status, "fail");
  assert.equal(result.exitCode, 1);
  assert.match(output, /Missing required environment variable <configured tracker auth env var>/);
  assert.doesNotMatch(output, /super-secret-token/);
});

test("rg run --status-only fails safely on Linear API errors without leaking secrets", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "rg-run-api-fail-"));
  await runInitCommand(cwd);
  await writeConfig(cwd, defaultConfigYaml);

  const result = await runRunCommand(
    cwd,
    {GR_LINEAR_API_KEY: "super-secret-token"},
    {
      statusOnly: true,
      linearFetchFn: async () => response({
        errors: [{message: "Authentication failed for super-secret-token"}]
      })
    }
  );
  const output = formatRunResult(result);

  assert.equal(result.status, "fail");
  assert.equal(result.exitCode, 1);
  assert.match(output, /Linear status reporting failed/);
  assert.doesNotMatch(output, /super-secret-token/);
});

async function writeConfig(cwd, text) {
  await writeFile(join(cwd, ".ai-agent", "config.yaml"), text);
}

function response(payload, ok = true, status = 200) {
  return {
    ok,
    status,
    async json() {
      return payload;
    }
  };
}

function issue({id, state, title, url = `https://linear.app/example/issue/RIV-${id}`}) {
  return {
    id,
    identifier: `RIV-${id}`,
    title,
    description: null,
    url,
    updatedAt: "2026-04-25T12:00:00.000Z",
    state: {name: state},
    labels: {
      nodes: [{name: "ai-agent"}]
    }
  };
}

async function snapshotFiles(root) {
  const snapshot = [];
  await collectFiles(root, root, snapshot);
  return snapshot.sort((left, right) => left.path.localeCompare(right.path));
}

async function collectFiles(root, current, snapshot) {
  const entries = await readdir(current, {withFileTypes: true});
  for (const entry of entries) {
    const path = join(current, entry.name);
    const relativePath = path.slice(root.length + 1);
    if (entry.isDirectory()) {
      await collectFiles(root, path, snapshot);
      continue;
    }

    snapshot.push({
      path: relativePath,
      content: await readFile(path, "utf8")
    });
  }
}
