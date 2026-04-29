import {Command, Flags} from "@oclif/core";
import {runStatusOnly, type RunStatusOnlyOptions} from "../core/run-status.js";
import type {FetchLike as LinearFetchLike} from "../adapters/linear-tracker-adapter.js";

export type RunCommandResult =
  | {
    status: "blocked";
    reason: "notImplemented";
    message: string;
    exitCode: 1;
  }
  | {
    status: "pass";
    message: string;
    exitCode: 0;
  }
  | {
    status: "fail";
    message: string;
    exitCode: 1;
  };

export type RunCommandOptions = RunStatusOnlyOptions & {
  statusOnly: boolean;
  linearFetchFn?: LinearFetchLike;
};

export async function runRunCommand(
  cwd: string,
  env: NodeJS.ProcessEnv,
  options: RunCommandOptions
): Promise<RunCommandResult> {
  if (options.statusOnly) {
    return runStatusOnly(cwd, env, {
      linearFetchFn: options.linearFetchFn
    });
  }

  return {
    status: "blocked",
    reason: "notImplemented",
    message: "rg run command surface exists; task execution is implemented in later stories",
    exitCode: 1
  };
}

export function formatRunResult(result: RunCommandResult): string {
  return result.message;
}

export default class RunCommand extends Command {
  static override description = "Run rg task automation";

  static override flags = {
    "status-only": Flags.boolean({
      summary: "Report agent-owned Linear tasks without executing work"
    })
  };

  async run(): Promise<void> {
    const {flags} = await this.parse(RunCommand);
    const result = await runRunCommand(process.cwd(), process.env, {
      statusOnly: flags["status-only"]
    });
    this.log(formatRunResult(result));
    this.exit(result.exitCode);
  }
}
