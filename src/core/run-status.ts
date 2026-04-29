import {LinearTrackerAdapter, type FetchLike as LinearFetchLike} from "../adapters/linear-tracker-adapter.js";
import {loadRuntimeConfigValidation} from "../config/config.js";
import {readEnv} from "../config/env.js";
import type {TrackerIssue} from "../types/task.js";

export type RunStatusOnlyResult =
  | {status: "pass"; exitCode: 0; message: string}
  | {status: "fail"; exitCode: 1; message: string};

export type RunStatusOnlyOptions = {
  linearFetchFn?: LinearFetchLike;
};

export async function runStatusOnly(
  cwd: string,
  env: NodeJS.ProcessEnv,
  options: RunStatusOnlyOptions = {}
): Promise<RunStatusOnlyResult> {
  const configResult = await loadRuntimeConfigValidation(cwd);
  const trackerIssues = getStatusOnlyConfigIssues(configResult);
  if (trackerIssues.length > 0) {
    return {
      status: "fail",
      exitCode: 1,
      message: `${trackerIssues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")}. Fix: edit .ai-agent/config.yaml and rerun rg run --status-only.`
    };
  }

  const token = readEnv(env, configResult.config.tracker.authEnv);
  if (token.status === "missing") {
    return {
      status: "fail",
      exitCode: 1,
      message: `Missing required environment variable ${formatTrackerAuthEnvName(configResult.config.tracker.authEnv)}. Fix: export ${formatTrackerAuthEnvName(configResult.config.tracker.authEnv)}=<linear-api-key> or change tracker.authEnv in .ai-agent/config.yaml.`
    };
  }

  const adapter = new LinearTrackerAdapter({
    token: token.value,
    fetchFn: options.linearFetchFn
  });
  const result = await adapter.listAgentIssues({
    eligibilityLabel: configResult.config.tracker.eligibilityLabel
  });

  if (!result.ok) {
    return {
      status: "fail",
      exitCode: 1,
      message: `Linear status reporting failed: ${redact(result.error.message, [token.value])}. Fix: verify the Linear token, API access, and eligibility label.`
    };
  }

  return {
    status: "pass",
    exitCode: 0,
    message: formatStatusReport(result.value, configResult.config.tracker.eligibleStatuses, configResult.config.tracker.eligibilityLabel)
  };
}

function formatStatusReport(issues: TrackerIssue[], eligibleStatuses: string[], eligibilityLabel: string): string {
  if (issues.length === 0) {
    return `No Linear issues found with label ${eligibilityLabel}.`;
  }

  const issuesByState = new Map<string, TrackerIssue[]>();
  for (const issue of issues) {
    const state = issue.state.trim() === "" ? "Unknown" : issue.state;
    const existing = issuesByState.get(state) ?? [];
    existing.push(issue);
    issuesByState.set(state, existing);
  }

  const remainingStates = [...issuesByState.keys()]
    .filter((state) => !eligibleStatuses.includes(state))
    .sort((left, right) => left.localeCompare(right));
  const orderedStates = [
    ...eligibleStatuses.filter((state) => issuesByState.has(state)),
    ...remainingStates
  ];

  const lines = [`Linear tasks for label ${eligibilityLabel}:`];
  for (const state of orderedStates) {
    const issuesForState = [...(issuesByState.get(state) ?? [])]
      .sort((left, right) => left.identifier.localeCompare(right.identifier));
    lines.push(`STATUS ${state}${eligibleStatuses.includes(state) ? " [eligible for pickup]" : ""}`);
    for (const issue of issuesForState) {
      lines.push(
        issue.url === null
          ? `- ${issue.identifier} | ${state} | ${issue.title}`
          : `- ${issue.identifier} | ${state} | ${issue.title} | ${issue.url}`
      );
    }
  }

  return lines.join("\n");
}

function redact(message: string, secrets: string[]): string {
  return secrets.reduce((current, secret) => secret === "" ? current : current.split(secret).join("[redacted]"), message);
}

function getStatusOnlyConfigIssues(
  configResult: Awaited<ReturnType<typeof loadRuntimeConfigValidation>>
) {
  if (configResult.status === "valid") {
    return [];
  }

  return configResult.issues.filter((issue) => issue.path === "tracker.provider"
    || issue.path === "tracker.authEnv"
    || issue.path === "tracker.eligibleStatuses"
    || issue.path === "tracker.eligibilityLabel");
}

function formatTrackerAuthEnvName(name: string): string {
  return isSafeEnvVarName(name) ? name : "<configured tracker auth env var>";
}

function isSafeEnvVarName(name: string): boolean {
  return /^[A-Z_][A-Z0-9_]*$/.test(name);
}
