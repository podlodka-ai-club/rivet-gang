import {basename} from "node:path";
import {loadRuntimeConfigValidation, type ConfigValidationResult} from "./config.js";
import {loadRepositoryInstructions} from "../state/repository-instructions.js";

export type RepositoryInstructionsMetadata =
  | { status: "loaded"; path: string; fileName: string; contentLength: number }
  | { status: "missing"; path: string; fileName: string }
  | { status: "error"; path: string; fileName: string; message: string };

export type RuntimeContext = {
  config: ConfigValidationResult;
  repositoryInstructions: RepositoryInstructionsMetadata;
};

export async function loadRuntimeContext(cwd: string): Promise<RuntimeContext> {
  const [config, instructions] = await Promise.all([
    loadRuntimeConfigValidation(cwd),
    loadRepositoryInstructions(cwd)
  ]);

  return {
    config,
    repositoryInstructions: toRepositoryInstructionsMetadata(instructions)
  };
}

function toRepositoryInstructionsMetadata(
  instructions: Awaited<ReturnType<typeof loadRepositoryInstructions>>
): RepositoryInstructionsMetadata {
  if (instructions.status === "loaded") {
    return {
      status: "loaded",
      path: instructions.path,
      fileName: basename(instructions.path),
      contentLength: instructions.content.length
    };
  }

  if (instructions.status === "missing") {
    return {
      status: "missing",
      path: instructions.path,
      fileName: basename(instructions.path)
    };
  }

  return {
    status: "error",
    path: instructions.path,
    fileName: basename(instructions.path),
    message: instructions.message
  };
}
