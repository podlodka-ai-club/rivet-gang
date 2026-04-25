import assert from "node:assert/strict";
import {access, mkdtemp, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {test} from "node:test";
import {defaultConfigYaml} from "../../dist/config/defaults.js";
import {formatDoctorResult, runDoctorCommand} from "../../dist/commands/doctor.js";
import {runInitCommand} from "../../dist/commands/init.js";

test("rg doctor reports missing Linear authentication without leaking secret values", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "rg-doctor-missing-"));
  await writeFile(join(cwd, "AGENTS.md"), "# Test Instructions\n");
  await runInitCommand(cwd);

  await writeConfig(cwd, completeConfig());

  const result = await runDoctorCommand(cwd, { GR_LINEAR_API_KEY: "", GR_LLM_API_KEY: "" });
  const output = formatDoctorResult(result);

  assert.equal(result.status, "fail");
  assert.equal(result.exitCode, 1);
  assert.match(output, /FAIL linear authentication/);
  assert.match(output, /FAIL llm authentication/);
  assert.match(output, /GR_LINEAR_API_KEY/);
  assert.match(output, /GR_LLM_API_KEY/);
  assert.doesNotMatch(output, /super-secret-token/);
});

test("rg doctor reports all readiness checks and verifies configured APIs", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "rg-doctor-pass-"));
  await writeFile(join(cwd, "AGENTS.md"), "# Test Instructions\n");
  await runInitCommand(cwd);
  await writeConfig(cwd, completeConfig());

  const seenLinearHeaders = [];
  const linearFetchFn = async (_url, init) => {
    seenLinearHeaders.push(init.headers);
    return {
      ok: true,
      status: 200,
      async json() {
        return { data: { viewer: { id: "user-id" } } };
      }
    };
  };
  const seenLlmHeaders = [];
  const llmFetchFn = async (_url, init) => {
    seenLlmHeaders.push(init.headers);
    return {
      ok: true,
      status: 200,
      async json() {
        return {id: "gpt-test"};
      }
    };
  };

  const result = await runDoctorCommand(
    cwd,
    {GR_LINEAR_API_KEY: "super-secret-token", GR_LLM_API_KEY: "llm-secret-token", PATH: process.env.PATH},
    {linearFetchFn, llmFetchFn}
  );
  const output = formatDoctorResult(result);

  assert.equal(result.status, "pass");
  assert.equal(result.exitCode, 0);
  assert.match(output, /PASS repository access/);
  assert.match(output, /PASS repository instructions/);
  assert.match(output, /PASS config validation/);
  assert.match(output, /PASS vcs configuration/);
  assert.match(output, /PASS linear authentication/);
  assert.match(output, /PASS llm configuration/);
  assert.match(output, /PASS llm api/);
  assert.match(output, /PASS command test/);
  assert.match(output, /PASS command lint/);
  assert.match(output, /PASS command typecheck/);
  assert.match(output, /PASS command secretScan/);
  assert.doesNotMatch(output, /super-secret-token/);
  assert.doesNotMatch(output, /llm-secret-token/);
  assert.equal(seenLinearHeaders[0].authorization, "super-secret-token");
  assert.equal(seenLlmHeaders[0].authorization, "Bearer llm-secret-token");
});

test("rg doctor explains how to fix missing LLM and command configuration", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "rg-doctor-fix-guidance-"));
  await writeFile(join(cwd, "AGENTS.md"), "# Test Instructions\n");
  await runInitCommand(cwd);

  const result = await runDoctorCommand(
    cwd,
    {GR_LINEAR_API_KEY: "super-secret-token", PATH: process.env.PATH},
    {linearFetchFn: passingLinearFetch}
  );
  const output = formatDoctorResult(result);

  assert.equal(result.status, "fail");
  assert.match(output, /FAIL llm configuration: .*Fix: set llm\.provider, llm\.model, llm\.authEnv, and llm\.baseUrl/);
  assert.match(output, /WARN command test: not configured\. Optional: set validation\.test/);
  assert.match(output, /WARN command lint: not configured\. Optional: set validation\.lint/);
  assert.match(output, /WARN command typecheck: not configured\. Optional: set validation\.typecheck/);
  assert.match(output, /WARN command secretScan: not configured\. Optional: set validation\.secretScan/);
  assert.doesNotMatch(output, /super-secret-token/);
});

test("rg doctor reports unsafe commands without executing them", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "rg-doctor-unsafe-"));
  const sentinel = join(cwd, "sentinel");
  await writeFile(join(cwd, "AGENTS.md"), "# Test Instructions\n");
  await runInitCommand(cwd);
  await writeConfig(cwd, completeConfig({testCommand: `${process.execPath} --version; touch ${sentinel}`}));

  const result = await runDoctorCommand(
    cwd,
    {GR_LINEAR_API_KEY: "super-secret-token", GR_LLM_API_KEY: "llm-secret-token", PATH: process.env.PATH},
    {linearFetchFn: passingLinearFetch, llmFetchFn: passingLlmFetch}
  );
  const output = formatDoctorResult(result);

  assert.equal(result.status, "pass");
  assert.equal(result.exitCode, 0);
  assert.match(output, /WARN command test/);
  assert.match(output, /unsafe/);
  assert.match(output, /Overall: pass/);
  await assert.rejects(access(sentinel));
});

test("rg doctor reports unavailable command binaries", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "rg-doctor-unavailable-"));
  await writeFile(join(cwd, "AGENTS.md"), "# Test Instructions\n");
  await runInitCommand(cwd);
  await writeConfig(cwd, completeConfig({lintCommand: "definitely-not-rg-command"}));

  const result = await runDoctorCommand(
    cwd,
    {GR_LINEAR_API_KEY: "super-secret-token", GR_LLM_API_KEY: "llm-secret-token", PATH: process.env.PATH},
    {linearFetchFn: passingLinearFetch, llmFetchFn: passingLlmFetch}
  );
  const output = formatDoctorResult(result);

  assert.equal(result.status, "pass");
  assert.equal(result.exitCode, 0);
  assert.match(output, /WARN command lint/);
  assert.match(output, /unavailable/);
  assert.match(output, /Overall: pass/);
});

test("rg doctor normalizes LLM API failures without leaking secrets", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "rg-doctor-llm-fail-"));
  await writeFile(join(cwd, "AGENTS.md"), "# Test Instructions\n");
  await runInitCommand(cwd);
  await writeConfig(cwd, completeConfig());

  const result = await runDoctorCommand(
    cwd,
    {GR_LINEAR_API_KEY: "super-secret-token", GR_LLM_API_KEY: "llm-secret-token", PATH: process.env.PATH},
    {
      linearFetchFn: passingLinearFetch,
      llmFetchFn: async () => ({
        ok: false,
        status: 401,
        async json() {
          return {error: {message: "invalid api key"}};
        }
      })
    }
  );
  const output = formatDoctorResult(result);

  assert.equal(result.status, "fail");
  assert.match(output, /FAIL llm api/);
  assert.doesNotMatch(output, /llm-secret-token/);
});

function completeConfig(overrides = {}) {
  const command = process.execPath;
  return defaultConfigYaml
    .replace("  provider: null\n  model: null\n  authEnv: GR_LLM_API_KEY\n  baseUrl: null", "  provider: openai-compatible\n  model: gpt-test\n  authEnv: GR_LLM_API_KEY\n  baseUrl: https://llm.example/v1")
    .replace("  test: null", `  test: ${overrides.testCommand ?? command}`)
    .replace("  lint: null", `  lint: ${overrides.lintCommand ?? command}`)
    .replace("  typecheck: null", `  typecheck: ${overrides.typecheckCommand ?? command}`)
    .replace("  secretScan: null", `  secretScan: ${overrides.secretScanCommand ?? command}`);
}

async function writeConfig(cwd, text) {
  await writeFile(join(cwd, ".ai-agent", "config.yaml"), text);
}

async function passingLinearFetch() {
  return {
    ok: true,
    status: 200,
    async json() {
      return {data: {viewer: {id: "user-id"}}};
    }
  };
}

async function passingLlmFetch() {
  return {
    ok: true,
    status: 200,
    async json() {
      return {id: "gpt-test"};
    }
  };
}
