import { saveRegistry, syncProject } from "@devloop/core";
import { Command } from "commander";

export function syncCommand(): Command {
  return new Command("sync")
    .description("Capture changed files and refresh the devloop registry.")
    .action(async () => {
      const projectRoot = process.cwd();
      const now = new Date().toISOString();
      const registry = await syncProject(projectRoot, { now });

      await saveRegistry(projectRoot, registry);
      console.log(JSON.stringify(registry, null, 2));
    });
}
