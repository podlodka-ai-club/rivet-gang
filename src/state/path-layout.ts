import {mkdir, writeFile} from "node:fs/promises";
import {join} from "node:path";
import {defaultConfigYaml} from "../config/defaults.js";

export type RuntimePaths = {
  root: string;
  config: string;
  state: string;
  tasks: string;
  logs: string;
  locks: string;
};

export function getRuntimePaths(cwd: string): RuntimePaths {
  const root = join(cwd, ".ai-agent");

  return {
    root,
    config: join(root, "config.yaml"),
    state: join(root, "state"),
    tasks: join(root, "tasks"),
    logs: join(root, "logs"),
    locks: join(root, "locks")
  };
}

export async function ensureRuntimeLayout(cwd: string): Promise<RuntimePaths> {
  const paths = getRuntimePaths(cwd);

  await mkdir(paths.state, { recursive: true });
  await mkdir(paths.tasks, { recursive: true });
  await mkdir(paths.logs, { recursive: true });
  await mkdir(paths.locks, { recursive: true });
  await writeFile(paths.config, defaultConfigYaml, { flag: "wx" }).catch((error: unknown) => {
    if (!isExistingFile(error)) {
      throw error;
    }
  });

  return paths;
}

function isExistingFile(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "EEXIST";
}
