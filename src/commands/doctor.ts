import {Command} from "@oclif/core";
import {LinearTrackerAdapter, type FetchLike} from "../adapters/linear-tracker-adapter.js";
import {loadRuntimeConfig} from "../config/config.js";
import {readEnv} from "../config/env.js";
import {loadRepositoryInstructions} from "../state/repository-instructions.js";

export type DoctorCheck = {
  name: string;
  status: "pass" | "fail";
  message: string;
};

export type DoctorCommandResult = {
  status: "pass" | "fail";
  exitCode: number;
  checks: DoctorCheck[];
};

export async function runDoctorCommand(
  cwd: string,
  env: NodeJS.ProcessEnv,
  fetchFn?: FetchLike
): Promise<DoctorCommandResult> {
  const config = await loadRuntimeConfig(cwd);
  const checks: DoctorCheck[] = [];

  const instructions = await loadRepositoryInstructions(cwd);
  checks.push({
    name: "repository instructions",
    status: instructions.status === "loaded" ? "pass" : "fail",
    message: instructions.status === "loaded" ? "AGENTS.md loaded" : "AGENTS.md is not available"
  });

  const token = readEnv(env, config.tracker.authEnv);
  if (token.status === "missing") {
    checks.push({
      name: "linear authentication",
      status: "fail",
      message: `Missing required environment variable ${config.tracker.authEnv}`
    });

    return summarizeChecks(checks);
  }

  const adapter = new LinearTrackerAdapter({ token: token.value, fetchFn });
  const result = await adapter.verifyAccess();

  checks.push({
    name: "linear authentication",
    status: result.ok ? "pass" : "fail",
    message: result.ok ? "Linear access verified" : result.error.message
  });

  return summarizeChecks(checks);
}

export function formatDoctorResult(result: DoctorCommandResult): string {
  const lines = result.checks.map((check) => {
    const marker = check.status === "pass" ? "PASS" : "FAIL";
    return `${marker} ${check.name}: ${check.message}`;
  });

  lines.push(`Overall: ${result.status}`);
  return lines.join("\n");
}

export default class DoctorCommand extends Command {
  static override description = "Check rg local and Linear integration readiness";

  async run(): Promise<void> {
    const result = await runDoctorCommand(process.cwd(), process.env);
    this.log(formatDoctorResult(result));

    if (result.exitCode !== 0) {
      this.exit(result.exitCode);
    }
  }
}

function summarizeChecks(checks: DoctorCheck[]): DoctorCommandResult {
  const failed = checks.some((check) => check.status === "fail");

  return {
    status: failed ? "fail" : "pass",
    exitCode: failed ? 1 : 0,
    checks
  };
}
