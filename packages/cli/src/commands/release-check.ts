import { runReleaseCheck } from "@devloop/core";
import { Command, InvalidArgumentError } from "commander";

function parseBoolean(value: string): boolean {
  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  throw new InvalidArgumentError("strict-snapshot must be true or false");
}

export function releaseCheckCommand(): Command {
  return new Command("release-check")
    .description("Evaluate whether the current HEAD is ready to release.")
    .option(
      "--strict-snapshot <boolean>",
      "Require git-backed evidence in snapshot mode. Use false to allow pass without git.",
      parseBoolean
    )
    .action(async ({ strictSnapshot }: { strictSnapshot?: boolean }) => {
      const result = await runReleaseCheck(process.cwd(), {
        strictSnapshot
      });

      console.log(JSON.stringify(result, null, 2));
      process.exitCode = result.decision === "block" ? 1 : 0;
    });
}
