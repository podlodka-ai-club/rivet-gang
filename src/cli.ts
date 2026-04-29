import {runDoctorCommand, formatDoctorResult} from "./commands/doctor.js";
import {runInitCommand} from "./commands/init.js";
import {runRunCommand} from "./commands/run.js";

export type CliIO = {
  argv: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
  stdout: Pick<NodeJS.WriteStream, "write">;
  stderr: Pick<NodeJS.WriteStream, "write">;
};

export async function runCli(io: CliIO): Promise<number> {
  const command = io.argv[0];

  if (command === "init") {
    const result = await runInitCommand(io.cwd);
    io.stdout.write(`${result.message}\n`);
    return 0;
  }

  if (command === "doctor") {
    const result = await runDoctorCommand(io.cwd, io.env);
    io.stdout.write(`${formatDoctorResult(result)}\n`);
    return result.exitCode;
  }

  if (command === "run") {
    const result = await runRunCommand(io.cwd, io.env, {
      statusOnly: io.argv.includes("--status-only")
    });
    io.stdout.write(`${result.message}\n`);
    return result.exitCode;
  }

  io.stderr.write("Usage: rg <init|doctor|run>\n");
  return 1;
}
