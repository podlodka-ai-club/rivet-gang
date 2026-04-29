import {access} from "node:fs/promises";
import {delimiter, isAbsolute, join} from "node:path";
import {constants} from "node:fs";

export type CommandReadinessResult =
  | { status: "pass"; command: string; executable: string }
  | { status: "fail"; reason: "notConfigured" | "unsafe" | "unavailable"; message: string };

export async function checkCommandReadiness(command: string | null, pathValue: string | undefined): Promise<CommandReadinessResult> {
  if (command === null || command.trim() === "") {
    return {status: "fail", reason: "notConfigured", message: "not configured"};
  }

  if (hasShellControl(command)) {
    return {status: "fail", reason: "unsafe", message: "unsafe command syntax"};
  }

  const executable = command.trim().split(/\s+/)[0];
  const resolved = await resolveExecutable(executable, pathValue);
  if (!resolved) {
    return {status: "fail", reason: "unavailable", message: `unavailable executable ${executable}`};
  }

  return {status: "pass", command, executable: resolved};
}

function hasShellControl(command: string): boolean {
  return /(\|\||&&|\||>|<|;|`|\$\(|[\r\n])/.test(command);
}

async function resolveExecutable(executable: string, pathValue: string | undefined): Promise<string | null> {
  if (executable.includes("/") || isAbsolute(executable)) {
    return await canExecute(executable) ? executable : null;
  }

  for (const directory of (pathValue ?? "").split(delimiter)) {
    if (directory === "") {
      continue;
    }

    const candidate = join(directory, executable);
    if (await canExecute(candidate)) {
      return candidate;
    }
  }

  return null;
}

async function canExecute(path: string): Promise<boolean> {
  try {
    await access(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}
