import {access} from "node:fs/promises";
import {Command} from "@oclif/core";
import {LinearTrackerAdapter, type FetchLike as LinearFetchLike} from "../adapters/linear-tracker-adapter.js";
import {OpenAiCompatibleLlmAdapter, type LlmFetchLike} from "../adapters/llm-adapter.js";
import {loadRuntimeConfigValidation} from "../config/config.js";
import {readEnv} from "../config/env.js";
import {checkCommandReadiness} from "../policy/command-readiness.js";
import {loadRepositoryInstructions} from "../state/repository-instructions.js";

export type DoctorCheck = {
  name: string;
  status: "pass" | "warn" | "fail";
  message: string;
};

export type DoctorCommandResult = {
  status: "pass" | "fail";
  exitCode: number;
  checks: DoctorCheck[];
};

export type DoctorCommandOptions = {
  linearFetchFn?: LinearFetchLike;
  llmFetchFn?: LlmFetchLike;
};

export async function runDoctorCommand(
  cwd: string,
  env: NodeJS.ProcessEnv,
  options: DoctorCommandOptions = {}
): Promise<DoctorCommandResult> {
  const configResult = await loadRuntimeConfigValidation(cwd);
  const config = configResult.config;
  const checks: DoctorCheck[] = [];

  checks.push(await checkRepositoryAccess(cwd));

  const instructions = await loadRepositoryInstructions(cwd);
  checks.push({
    name: "repository instructions",
    status: instructions.status === "loaded" ? "pass" : "fail",
    message: instructions.status === "loaded"
      ? "AGENTS.md loaded"
      : "AGENTS.md is not available. Fix: add AGENTS.md at the repository root."
  });

  checks.push({
    name: "config validation",
    status: configResult.status === "valid" ? "pass" : "fail",
    message: configResult.status === "valid"
      ? "runtime config is valid"
      : `${configResult.issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")}. Fix: edit .ai-agent/config.yaml and rerun rg doctor.`
  });

  checks.push({
    name: "vcs configuration",
    status: config.vcs.provider === "github" && config.vcs.defaultBranch.trim() !== "" && config.vcs.branchPrefix.trim() !== ""
      ? "pass"
      : "fail",
    message: config.vcs.provider === "github" && config.vcs.defaultBranch.trim() !== "" && config.vcs.branchPrefix.trim() !== ""
      ? `github configured for ${config.vcs.defaultBranch}`
      : "github provider, default branch, and branch prefix are required. Fix: set vcs.provider, vcs.defaultBranch, and vcs.branchPrefix in .ai-agent/config.yaml."
  });

  const linearToken = readEnv(env, config.tracker.authEnv);
  if (linearToken.status === "missing") {
    checks.push({
      name: "linear authentication",
      status: "fail",
      message: `Missing required environment variable ${config.tracker.authEnv}. Fix: export ${config.tracker.authEnv}=<linear-api-key> or change tracker.authEnv in .ai-agent/config.yaml.`
    });
  } else {
    const adapter = new LinearTrackerAdapter({ token: linearToken.value, fetchFn: options.linearFetchFn });
    const result = await adapter.verifyAccess();

    checks.push({
      name: "linear authentication",
      status: result.ok ? "pass" : "fail",
      message: result.ok
        ? "Linear access verified"
        : `${redact(result.error.message, [linearToken.value])}. Fix: verify the Linear token and workspace access.`
    });
  }

  const llmProvider = config.llm.provider;
  const llmModel = config.llm.model;
  const llmBaseUrl = config.llm.baseUrl;
  const llmConfigured = llmProvider !== null && llmModel !== null && llmBaseUrl !== null;
  checks.push({
    name: "llm configuration",
    status: llmConfigured ? "pass" : "fail",
    message: llmConfigured
      ? `${llmProvider} configured with model ${llmModel}`
      : "LLM provider, model, auth env, and API base URL are required. Fix: set llm.provider, llm.model, llm.authEnv, and llm.baseUrl in .ai-agent/config.yaml; then export the env var named by llm.authEnv."
  });

  if (llmConfigured) {
    const llmToken = readEnv(env, config.llm.authEnv);
    if (llmToken.status === "missing") {
      checks.push({
        name: "llm authentication",
        status: "fail",
        message: `Missing required environment variable ${config.llm.authEnv}. Fix: export ${config.llm.authEnv}=<llm-api-key> or change llm.authEnv in .ai-agent/config.yaml.`
      });
    } else {
      checks.push({
        name: "llm authentication",
        status: "pass",
        message: `${config.llm.authEnv} is configured`
      });

      const adapter = new OpenAiCompatibleLlmAdapter({
        provider: llmProvider,
        token: llmToken.value,
        baseUrl: llmBaseUrl,
        fetchFn: options.llmFetchFn
      });
      const result = await adapter.verifyModelAccess(llmModel);

      checks.push({
        name: "llm api",
        status: result.ok ? "pass" : "fail",
        message: result.ok
          ? `${llmProvider} model ${llmModel} is reachable`
          : `${redact(result.error.message, [llmToken.value])}. Fix: verify the LLM API key, base URL, model name, and provider access.`
      });
    }
  }

  for (const [name, command] of Object.entries(config.validation)) {
    const result = await checkCommandReadiness(command, env.PATH);
    checks.push({
      name: `command ${name}`,
      status: result.status === "pass" ? "pass" : "warn",
      message: result.status === "pass" ? `available: ${result.command}` : commandFixMessage(name, result)
    });
  }

  return summarizeChecks(checks);
}

export function formatDoctorResult(result: DoctorCommandResult): string {
  const lines = result.checks.map((check) => {
    const marker = check.status === "pass" ? "PASS" : check.status === "warn" ? "WARN" : "FAIL";
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

async function checkRepositoryAccess(cwd: string): Promise<DoctorCheck> {
  try {
    await access(cwd);
    return {name: "repository access", status: "pass", message: "repository directory is readable"};
  } catch {
    return {name: "repository access", status: "fail", message: "repository directory is not readable"};
  }
}

function redact(message: string, secrets: string[]): string {
  return secrets.reduce((current, secret) => secret === "" ? current : current.split(secret).join("[redacted]"), message);
}

function commandFixMessage(name: string, result: Exclude<Awaited<ReturnType<typeof checkCommandReadiness>>, {status: "pass"}>): string {
  if (result.reason === "notConfigured") {
    return `not configured. Optional: set validation.${name} in .ai-agent/config.yaml to get stronger pre-review checks.`;
  }

  if (result.reason === "unsafe") {
    return `${result.message}. Optional fix: use a direct command without shell control syntax, or split the workflow into separate configured commands.`;
  }

  return `${result.message}. Optional fix: install the executable, update PATH, or change validation.${name} in .ai-agent/config.yaml.`;
}
