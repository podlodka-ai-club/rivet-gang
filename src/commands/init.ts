import {Command} from "@oclif/core";
import {ensureRuntimeLayout} from "../state/path-layout.js";

export type InitCommandResult = {
  status: "ok";
  message: string;
};

export async function runInitCommand(cwd: string): Promise<InitCommandResult> {
  await ensureRuntimeLayout(cwd);

  return {
    status: "ok",
    message: "Initialized .ai-agent runtime layout"
  };
}

export default class InitCommand extends Command {
  static override description = "Initialize rg runtime state and configuration";

  async run(): Promise<void> {
    const result = await runInitCommand(process.cwd());
    this.log(result.message);
  }
}
