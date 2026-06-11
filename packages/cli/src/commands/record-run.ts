import { recordTestRun } from "@devloop/core";
import { Command } from "commander";

export function recordRunCommand(): Command {
  return new Command("record-run")
    .description("Persist a DevLoop test run and update covered feature verification state.")
    .requiredOption("--scope <scope>", "Run scope: smoke, impacted, current, current+p0, or full")
    .requiredOption(
      "--status <status>",
      "Run status: passed, failed, partial, or aborted"
    )
    .requiredOption(
      "--scenario <id>",
      "Scenario id to attach to this run. Repeat the flag for multiple scenarios.",
      (value: string, previous: string[]) => [...previous, value],
      []
    )
    .option(
      "--artifact <path>",
      "Artifact path to associate with this run. Repeat the flag for multiple artifacts.",
      (value: string, previous: string[]) => [...previous, value],
      []
    )
    .option("--run-id <id>", "Optional explicit run id")
    .action(async (options) => {
      const result = await recordTestRun(process.cwd(), {
        runId: options.runId,
        scope: options.scope,
        status: options.status,
        scenarioIds: options.scenario,
        artifacts: options.artifact
      });

      console.log(JSON.stringify(result, null, 2));
    });
}
