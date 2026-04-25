import assert from "node:assert/strict";
import {mkdtemp, readFile, stat} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {test} from "node:test";
import {runInitCommand} from "../../dist/commands/init.js";

test("rg init creates runtime directories and Linear config template", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "rg-init-"));

  const result = await runInitCommand(cwd);

  assert.equal(result.status, "ok");
  await stat(join(cwd, ".ai-agent", "state"));
  await stat(join(cwd, ".ai-agent", "tasks"));
  await stat(join(cwd, ".ai-agent", "logs"));
  await stat(join(cwd, ".ai-agent", "locks"));

  const config = await readFile(join(cwd, ".ai-agent", "config.yaml"), "utf8");
  assert.match(config, /provider: linear/);
  assert.match(config, /authEnv: LINEAR_API_KEY/);
  assert.match(config, /eligibilityLabel: ai-agent/);
});

test("rg init is idempotent and does not overwrite existing config", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "rg-init-idempotent-"));

  await runInitCommand(cwd);
  const configPath = join(cwd, ".ai-agent", "config.yaml");
  const original = await readFile(configPath, "utf8");

  await runInitCommand(cwd);

  assert.equal(await readFile(configPath, "utf8"), original);
});
