import {readFile} from "node:fs/promises";
import {join} from "node:path";
import {defaultRuntimeConfig} from "./defaults.js";

export type RuntimeConfig = {
  tracker: {
    provider: string;
    authEnv: string;
    team: string | null;
    eligibleStatuses: string[];
    inAnalysisStatus: string;
    inReviewStatus: string;
    blockedStatus: string;
    clarificationReturnStatus: string;
    eligibilityLabel: string;
  };
  vcs: {
    provider: string;
    defaultBranch: string;
    branchPrefix: string;
  };
  llm: {
    provider: string | null;
    model: string | null;
  };
  validation: {
    test: string | null;
    lint: string | null;
    typecheck: string | null;
    secretScan: string | null;
  };
  limits: {
    maxParallelTasks: number;
    maxClarificationRounds: number;
    maxRepairAttempts: number;
  };
  killSwitch: {
    enabled: boolean | null;
  };
};

export type ConfigValidationIssue = {
  path: string;
  message: string;
};

export type ConfigValidationResult =
  | { status: "valid"; config: RuntimeConfig }
  | { status: "invalid"; config: RuntimeConfig; issues: ConfigValidationIssue[] };

export async function loadRuntimeConfig(cwd: string): Promise<RuntimeConfig> {
  const result = await loadRuntimeConfigValidation(cwd);
  return result.config;
}

export async function loadRuntimeConfigValidation(cwd: string): Promise<ConfigValidationResult> {
  const configPath = join(cwd, ".ai-agent", "config.yaml");

  try {
    const text = await readFile(configPath, "utf8");
    return validateRuntimeConfig(parseRuntimeConfig(text));
  } catch (error) {
    if (isMissingFile(error)) {
      return validateRuntimeConfig(cloneDefaultRuntimeConfig());
    }

    throw error;
  }
}

export function parseRuntimeConfig(text: string): RuntimeConfig {
  const sections = parseSections(text);
  const defaults = cloneDefaultRuntimeConfig();

  return {
    tracker: {
      provider: getScalar(sections, "tracker", "provider", defaults.tracker.provider),
      authEnv: getScalar(sections, "tracker", "authEnv", defaults.tracker.authEnv),
      team: getNullableScalar(sections, "tracker", "team", defaults.tracker.team),
      eligibleStatuses: getList(sections, "tracker", "eligibleStatuses", defaults.tracker.eligibleStatuses),
      inAnalysisStatus: getScalar(sections, "tracker", "inAnalysisStatus", defaults.tracker.inAnalysisStatus),
      inReviewStatus: getScalar(sections, "tracker", "inReviewStatus", defaults.tracker.inReviewStatus),
      blockedStatus: getScalar(sections, "tracker", "blockedStatus", defaults.tracker.blockedStatus),
      clarificationReturnStatus: getScalar(
        sections,
        "tracker",
        "clarificationReturnStatus",
        defaults.tracker.clarificationReturnStatus
      ),
      eligibilityLabel: getScalar(sections, "tracker", "eligibilityLabel", defaults.tracker.eligibilityLabel)
    },
    vcs: {
      provider: getScalar(sections, "vcs", "provider", defaults.vcs.provider),
      defaultBranch: getScalar(sections, "vcs", "defaultBranch", defaults.vcs.defaultBranch),
      branchPrefix: getScalar(sections, "vcs", "branchPrefix", defaults.vcs.branchPrefix)
    },
    llm: {
      provider: getNullableScalar(sections, "llm", "provider", defaults.llm.provider),
      model: getNullableScalar(sections, "llm", "model", defaults.llm.model)
    },
    validation: {
      test: getNullableScalar(sections, "validation", "test", defaults.validation.test),
      lint: getNullableScalar(sections, "validation", "lint", defaults.validation.lint),
      typecheck: getNullableScalar(sections, "validation", "typecheck", defaults.validation.typecheck),
      secretScan: getNullableScalar(sections, "validation", "secretScan", defaults.validation.secretScan)
    },
    limits: {
      maxParallelTasks: getNumber(sections, "limits", "maxParallelTasks", defaults.limits.maxParallelTasks),
      maxClarificationRounds: getNumber(
        sections,
        "limits",
        "maxClarificationRounds",
        defaults.limits.maxClarificationRounds
      ),
      maxRepairAttempts: getNumber(sections, "limits", "maxRepairAttempts", defaults.limits.maxRepairAttempts)
    },
    killSwitch: {
      enabled: getBoolean(sections, "killSwitch", "enabled", defaults.killSwitch.enabled)
    }
  };
}

export function validateRuntimeConfig(config: RuntimeConfig): ConfigValidationResult {
  const issues: ConfigValidationIssue[] = [];

  requireValue(issues, "tracker.authEnv", config.tracker.authEnv);
  requireValue(issues, "tracker.eligibilityLabel", config.tracker.eligibilityLabel);
  requireValue(issues, "tracker.inAnalysisStatus", config.tracker.inAnalysisStatus);
  requireValue(issues, "tracker.inReviewStatus", config.tracker.inReviewStatus);
  requireValue(issues, "tracker.blockedStatus", config.tracker.blockedStatus);
  requireValue(issues, "tracker.clarificationReturnStatus", config.tracker.clarificationReturnStatus);
  requireValue(issues, "vcs.defaultBranch", config.vcs.defaultBranch);
  requireValue(issues, "vcs.branchPrefix", config.vcs.branchPrefix);

  if (config.tracker.provider !== "linear") {
    issues.push({ path: "tracker.provider", message: "Only the linear tracker provider is supported in MVP" });
  }

  if (config.vcs.provider !== "github") {
    issues.push({ path: "vcs.provider", message: "Only the github VCS provider is configured in MVP defaults" });
  }

  if (config.tracker.eligibleStatuses.length === 0) {
    issues.push({ path: "tracker.eligibleStatuses", message: "At least one eligible tracker status is required" });
  }

  if (!Number.isInteger(config.limits.maxParallelTasks) || config.limits.maxParallelTasks !== 1) {
    issues.push({ path: "limits.maxParallelTasks", message: "MVP supervisor mode must remain sequential" });
  }

  if (!Number.isInteger(config.limits.maxClarificationRounds) || config.limits.maxClarificationRounds < 0) {
    issues.push({ path: "limits.maxClarificationRounds", message: "Clarification rounds cannot be negative" });
  }

  if (!Number.isInteger(config.limits.maxRepairAttempts) || config.limits.maxRepairAttempts < 0) {
    issues.push({ path: "limits.maxRepairAttempts", message: "Repair attempts cannot be negative" });
  }

  if (typeof config.killSwitch.enabled !== "boolean") {
    issues.push({ path: "killSwitch.enabled", message: "Kill switch enabled must be true or false" });
  }

  return issues.length === 0
    ? { status: "valid", config }
    : { status: "invalid", config, issues };
}

function cloneDefaultRuntimeConfig(): RuntimeConfig {
  return {
    tracker: {
      ...defaultRuntimeConfig.tracker,
      eligibleStatuses: [...defaultRuntimeConfig.tracker.eligibleStatuses]
    },
    vcs: { ...defaultRuntimeConfig.vcs },
    llm: { ...defaultRuntimeConfig.llm },
    validation: { ...defaultRuntimeConfig.validation },
    limits: { ...defaultRuntimeConfig.limits },
    killSwitch: { ...defaultRuntimeConfig.killSwitch }
  };
}

function parseSections(text: string): Map<string, string[]> {
  const sections = new Map<string, string[]>();
  const lines = text.split(/\r?\n/);
  let current: string | null = null;

  for (const line of lines) {
    const section = line.match(/^([A-Za-z][A-Za-z0-9]*):\s*$/);
    if (section) {
      current = section[1];
      sections.set(current, []);
      continue;
    }

    if (current && (line.startsWith(" ") || line.trim() === "")) {
      sections.get(current)?.push(line);
    }
  }

  return sections;
}

function getScalar(sections: Map<string, string[]>, section: string, key: string, fallback: string): string {
  const raw = getRawScalar(sections, section, key);
  return raw === null ? fallback : raw;
}

function getNullableScalar(
  sections: Map<string, string[]>,
  section: string,
  key: string,
  fallback: string | null
): string | null {
  const raw = getRawScalar(sections, section, key);
  if (raw === null) {
    return fallback;
  }

  return raw === "null" ? null : raw;
}

function getRawScalar(sections: Map<string, string[]>, section: string, key: string): string | null {
  for (const line of sections.get(section) ?? []) {
    const match = line.match(new RegExp(`^\\s*${key}:\\s*(.*?)\\s*$`));
    if (match) {
      return match[1].replace(/^["']|["']$/g, "");
    }
  }

  return null;
}

function getList(sections: Map<string, string[]>, section: string, key: string, fallback: string[]): string[] {
  const lines = sections.get(section) ?? [];
  const start = lines.findIndex((line) => line.trim() === `${key}:`);
  if (start === -1) {
    return [...fallback];
  }

  const values: string[] = [];
  for (const line of lines.slice(start + 1)) {
    const item = line.match(/^\s*-\s*(.+?)\s*$/);
    if (item) {
      values.push(item[1].replace(/^["']|["']$/g, ""));
      continue;
    }

    if (line.trim() !== "") {
      break;
    }
  }

  return values;
}

function getNumber(sections: Map<string, string[]>, section: string, key: string, fallback: number): number {
  const raw = getRawScalar(sections, section, key);
  if (raw === null) {
    return fallback;
  }

  if (raw === "") {
    return Number.NaN;
  }

  const value = Number(raw);
  return Number.isFinite(value) ? value : Number.NaN;
}

function getBoolean(
  sections: Map<string, string[]>,
  section: string,
  key: string,
  fallback: boolean | null
): boolean | null {
  const raw = getRawScalar(sections, section, key);
  if (raw === null) {
    return fallback;
  }

  if (raw === "true") {
    return true;
  }

  if (raw === "false") {
    return false;
  }

  return null;
}

function requireValue(issues: ConfigValidationIssue[], path: string, value: string): void {
  if (value.trim() === "") {
    issues.push({ path, message: "Value is required" });
  }
}

function isMissingFile(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
