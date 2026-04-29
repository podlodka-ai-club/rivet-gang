import {readFile} from "node:fs/promises";
import {join} from "node:path";

export type RepositoryInstructionsResult =
  | { status: "loaded"; path: string; content: string }
  | { status: "missing"; path: string }
  | { status: "error"; path: string; message: string };

export async function loadRepositoryInstructions(cwd: string): Promise<RepositoryInstructionsResult> {
  const path = join(cwd, "AGENTS.md");

  try {
    const content = await readFile(path, "utf8");
    return { status: "loaded", path, content };
  } catch (error) {
    if (isMissingFile(error)) {
      return { status: "missing", path };
    }

    return { status: "error", path, message: error instanceof Error ? error.message : "Unknown error" };
  }
}

function isMissingFile(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
