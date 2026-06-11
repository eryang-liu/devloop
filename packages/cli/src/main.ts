#!/usr/bin/env node

import { Command, CommanderError } from "commander";
import { captureCommand } from "./commands/capture.js";
import { launchConsole } from "./commands/console.js";
import { doctorCommand } from "./commands/doctor.js";
import { iterationCommand } from "./commands/iteration.js";
import { recordRunCommand } from "./commands/record-run.js";
import { releaseCheckCommand } from "./commands/release-check.js";
import { runScenarioCommand } from "./commands/run-scenario.js";
import { statusCommand } from "./commands/status.js";
import { syncCommand } from "./commands/sync.js";
import { uiCommand } from "./commands/ui.js";

export function buildProgram(): Command {
  const program = new Command().name("devloop");

  program.addCommand(captureCommand());
  program.addCommand(doctorCommand());
  program.addCommand(iterationCommand());
  program.addCommand(statusCommand());
  program.addCommand(syncCommand());
  program.addCommand(releaseCheckCommand());
  program.addCommand(recordRunCommand());
  program.addCommand(runScenarioCommand());
  program.addCommand(uiCommand());

  return program;
}

function isProjectConfigPath(pathValue: string): boolean {
  const normalizedPath = pathValue.replaceAll("\\", "/");
  return (
    normalizedPath === ".devloop/config.yml" || normalizedPath.endsWith("/.devloop/config.yml")
  );
}

function formatCliError(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT" &&
    "path" in error &&
    typeof error.path === "string" &&
    isProjectConfigPath(error.path)
  ) {
    return "Missing .devloop/config.yml in the current directory.";
  }

  if (error instanceof CommanderError) {
    const message = error.message.replace(/^error:\s*/i, "");

    if (message.length > 0) {
      return `${message[0].toUpperCase()}${message.slice(1)}.`;
    }
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "Unexpected error.";
}

export async function runCli(argv: string[]): Promise<number> {
  process.exitCode = 0;
  const program = buildProgram();
  const args = argv.slice(2);

  program.exitOverride();
  program.configureOutput({
    writeErr: () => {}
  });

  try {
    if (args.length === 0) {
      await launchConsole({ projectRoot: process.cwd() });
      process.exitCode = 0;
      return 0;
    }

    await program.parseAsync(argv);
    return process.exitCode ?? 0;
  } catch (error) {
    if (error instanceof CommanderError && error.exitCode === 0) {
      process.exitCode = 0;
      return 0;
    }

    console.error(`devloop: ${formatCliError(error)}`);
    process.exitCode = 1;
    return 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await runCli(process.argv);
}
