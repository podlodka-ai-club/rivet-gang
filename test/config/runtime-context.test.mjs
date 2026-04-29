import assert from "node:assert/strict";
import {mkdtemp, mkdir, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {test} from "node:test";
import {defaultConfigYaml} from "../../dist/config/defaults.js";
import {loadRuntimeContext} from "../../dist/config/runtime-context.js";

test("runtime context records loaded repository instructions without serializing content", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "rg-context-loaded-"));
  await mkdir(join(cwd, ".ai-agent"));
  await writeFile(join(cwd, ".ai-agent", "config.yaml"), defaultConfigYaml);
  await writeFile(join(cwd, "AGENTS.md"), "SECRET_INSTRUCTIONS_SHOULD_NOT_SERIALIZE\n");

  const context = await loadRuntimeContext(cwd);
  const serialized = JSON.stringify(context);

  assert.equal(context.repositoryInstructions.status, "loaded");
  assert.equal(context.repositoryInstructions.fileName, "AGENTS.md");
  assert.equal(context.repositoryInstructions.contentLength, "SECRET_INSTRUCTIONS_SHOULD_NOT_SERIALIZE\n".length);
  assert.doesNotMatch(serialized, /SECRET_INSTRUCTIONS_SHOULD_NOT_SERIALIZE/);
});

test("runtime context records missing repository instructions", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "rg-context-missing-"));

  const context = await loadRuntimeContext(cwd);

  assert.equal(context.config.status, "valid");
  assert.equal(context.repositoryInstructions.status, "missing");
  assert.equal(context.repositoryInstructions.fileName, "AGENTS.md");
});
