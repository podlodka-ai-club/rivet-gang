import {Command} from "@oclif/core";

export type RunCommandResult = {
  status: "blocked";
  reason: "notImplemented";
  message: string;
};

export async function runRunCommand(): Promise<RunCommandResult> {
  return {
    status: "blocked",
    reason: "notImplemented",
    message: "rg run command surface exists; task execution is implemented in later stories"
  };
}

export default class RunCommand extends Command {
  static override description = "Run rg task automation";

  async run(): Promise<void> {
    const result = await runRunCommand();
    this.log(result.message);
    this.exit(1);
  }
}
