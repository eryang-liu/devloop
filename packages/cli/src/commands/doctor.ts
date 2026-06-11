import { access } from "node:fs/promises";
import { Command } from "commander";

export function doctorCommand(): Command {
  return new Command("doctor")
    .description("Check that the current directory has devloop project config.")
    .action(async () => {
      await access(".devloop/config.yml");
      console.log(JSON.stringify({ ok: true, config: ".devloop/config.yml" }, null, 2));
    });
}
