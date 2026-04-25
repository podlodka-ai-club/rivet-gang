import {readFile} from "node:fs/promises";
import {join} from "node:path";
import {defaultTrackerConfig} from "./defaults.js";

export type RuntimeConfig = {
  tracker: {
    provider: "linear";
    authEnv: string;
    eligibleStatuses: string[];
    eligibilityLabel: string;
  };
};

export async function loadRuntimeConfig(cwd: string): Promise<RuntimeConfig> {
  const configPath = join(cwd, ".ai-agent", "config.yaml");

  try {
    const text = await readFile(configPath, "utf8");
    return parseRuntimeConfig(text);
  } catch (error) {
    if (isMissingFile(error)) {
      return {
        tracker: {
          ...defaultTrackerConfig,
          eligibleStatuses: [...defaultTrackerConfig.eligibleStatuses]
        }
      };
    }

    throw error;
  }
}

export function parseRuntimeConfig(text: string): RuntimeConfig {
  const authEnv = findScalar(text, "authEnv") ?? defaultTrackerConfig.authEnv;
  const eligibilityLabel = findScalar(text, "eligibilityLabel") ?? defaultTrackerConfig.eligibilityLabel;
  const eligibleStatuses = findList(text, "eligibleStatuses");

  return {
    tracker: {
      provider: "linear",
      authEnv,
      eligibleStatuses: eligibleStatuses.length > 0 ? eligibleStatuses : [...defaultTrackerConfig.eligibleStatuses],
      eligibilityLabel
    }
  };
}

function findScalar(text: string, key: string): string | null {
  const match = text.match(new RegExp(`^\\s*${key}:\\s*(.+?)\\s*$`, "m"));
  if (!match) {
    return null;
  }

  const value = match[1].trim();
  return value === "null" ? "" : value.replace(/^["']|["']$/g, "");
}

function findList(text: string, key: string): string[] {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === `${key}:`);
  if (start === -1) {
    return [];
  }

  const values: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (!line.startsWith(" ") && line.trim() !== "") {
      break;
    }

    const item = line.match(/^\s*-\s*(.+?)\s*$/);
    if (item) {
      values.push(item[1].replace(/^["']|["']$/g, ""));
    }
  }

  return values;
}

function isMissingFile(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
