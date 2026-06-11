import { getStatusSummary } from "@devloop/core";
import { Command } from "commander";

export function statusCommand(): Command {
  return new Command("status")
    .description("Show the current feature verification and release risk summary.")
    .action(async () => {
      const summary = await getStatusSummary(process.cwd());
      console.log(JSON.stringify(summary, null, 2));
    });
}
