import { listIterations, loadIteration } from "@devloop/core";
import { Command } from "commander";

export function iterationCommand(): Command {
  return new Command("iteration")
    .description("Inspect stored DevLoop iterations.")
    .addCommand(
      new Command("list")
        .description("List stored iterations for the current project.")
        .action(async () => {
          const iterations = await listIterations(process.cwd());
          console.log(JSON.stringify(iterations, null, 2));
        })
    )
    .addCommand(
      new Command("show")
        .description("Show a single stored iteration by id.")
        .argument("<iteration-id>", "Iteration id to load")
        .action(async (iterationId: string) => {
          const iteration = await loadIteration(process.cwd(), iterationId);
          console.log(JSON.stringify(iteration, null, 2));
        })
    );
}
