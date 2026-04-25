import assert from "node:assert/strict";
import {mkdtemp, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {test} from "node:test";
import {formatDoctorResult, runDoctorCommand} from "../../dist/commands/doctor.js";
import {runInitCommand} from "../../dist/commands/init.js";

test("rg doctor reports missing Linear authentication without leaking secret values", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "rg-doctor-missing-"));
  await writeFile(join(cwd, "AGENTS.md"), "# Test Instructions\n");
  await runInitCommand(cwd);

  const result = await runDoctorCommand(cwd, { LINEAR_API_KEY: "" });
  const output = formatDoctorResult(result);

  assert.equal(result.status, "fail");
  assert.equal(result.exitCode, 1);
  assert.match(output, /FAIL linear authentication/);
  assert.match(output, /LINEAR_API_KEY/);
  assert.doesNotMatch(output, /super-secret-token/);
});

test("rg doctor verifies Linear access with configured token", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "rg-doctor-pass-"));
  await writeFile(join(cwd, "AGENTS.md"), "# Test Instructions\n");
  await runInitCommand(cwd);

  const seenHeaders = [];
  const fetchFn = async (_url, init) => {
    seenHeaders.push(init.headers);
    return {
      ok: true,
      status: 200,
      async json() {
        return { data: { viewer: { id: "user-id" } } };
      }
    };
  };

  const result = await runDoctorCommand(cwd, { LINEAR_API_KEY: "super-secret-token" }, fetchFn);
  const output = formatDoctorResult(result);

  assert.equal(result.status, "pass");
  assert.equal(result.exitCode, 0);
  assert.match(output, /PASS linear authentication/);
  assert.doesNotMatch(output, /super-secret-token/);
  assert.equal(seenHeaders[0].authorization, "super-secret-token");
});
