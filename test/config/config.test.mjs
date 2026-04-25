import assert from "node:assert/strict";
import {mkdtemp} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {test} from "node:test";
import {
  defaultConfigYaml,
  defaultRuntimeConfig
} from "../../dist/config/defaults.js";
import {
  loadRuntimeConfigValidation,
  parseRuntimeConfig,
  validateRuntimeConfig
} from "../../dist/config/config.js";

test("generated config template parses into expanded runtime config", () => {
  const config = parseRuntimeConfig(defaultConfigYaml);

  assert.deepEqual(config, defaultRuntimeConfig);
  assert.equal(config.tracker.inAnalysisStatus, "In Analysis");
  assert.equal(config.tracker.inReviewStatus, "In Review");
  assert.equal(config.tracker.blockedStatus, "Blocked");
  assert.equal(config.tracker.clarificationReturnStatus, "To Do");
  assert.equal(config.vcs.branchPrefix, "ai-agent");
  assert.equal(config.validation.secretScan, null);
  assert.equal(config.killSwitch.enabled, false);
});

test("missing config file falls back to safe defaults", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "rg-config-missing-"));

  const result = await loadRuntimeConfigValidation(cwd);

  assert.equal(result.status, "valid");
  assert.deepEqual(result.config, defaultRuntimeConfig);
});

test("invalid config produces typed validation failures", () => {
  const config = parseRuntimeConfig(`tracker:
  provider: jira
  authEnv:
  eligibleStatuses:
vcs:
  provider: github
  defaultBranch:
  branchPrefix:
limits:
  maxParallelTasks: 2
`);

  const result = validateRuntimeConfig(config);

  assert.equal(result.status, "invalid");
  assert.ok(result.issues.some((issue) => issue.path === "tracker.provider"));
  assert.ok(result.issues.some((issue) => issue.path === "tracker.authEnv"));
  assert.ok(result.issues.some((issue) => issue.path === "tracker.eligibleStatuses"));
  assert.ok(result.issues.some((issue) => issue.path === "vcs.defaultBranch"));
  assert.ok(result.issues.some((issue) => issue.path === "vcs.branchPrefix"));
  assert.ok(result.issues.some((issue) => issue.path === "limits.maxParallelTasks"));
});

test("invalid numeric limits produce typed validation failures", () => {
  const config = parseRuntimeConfig(`limits:
  maxParallelTasks: abc
  maxClarificationRounds: 1.5
  maxRepairAttempts:
`);

  const result = validateRuntimeConfig(config);

  assert.equal(result.status, "invalid");
  assert.ok(result.issues.some((issue) => issue.path === "limits.maxParallelTasks"));
  assert.ok(result.issues.some((issue) => issue.path === "limits.maxClarificationRounds"));
  assert.ok(result.issues.some((issue) => issue.path === "limits.maxRepairAttempts"));
});

test("invalid kill switch values produce typed validation failures", () => {
  const config = parseRuntimeConfig(`killSwitch:
  enabled: maybe
`);

  const result = validateRuntimeConfig(config);

  assert.equal(result.status, "invalid");
  assert.ok(result.issues.some((issue) => issue.path === "killSwitch.enabled"));
});

test("config validation output contains env var names but not env values", () => {
  const config = parseRuntimeConfig(defaultConfigYaml);
  const result = validateRuntimeConfig(config);

  process.env.LINEAR_API_KEY = "super-secret-token";
  const serialized = JSON.stringify(result);

  assert.match(serialized, /LINEAR_API_KEY/);
  assert.doesNotMatch(serialized, /super-secret-token/);
});
