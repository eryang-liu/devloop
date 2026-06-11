import { launchDashboardRuntime } from "@devloop/server";
import { Command, InvalidArgumentError } from "commander";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_UI_PORT = 4300;
const bundledUiDistPath = resolve(dirname(fileURLToPath(import.meta.url)), "../../dist/ui");

function parsePort(value: string): number {
  const port = Number.parseInt(value, 10);

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new InvalidArgumentError("Port must be an integer between 1 and 65535");
  }

  return port;
}

export function uiCommand(): Command {
  return new Command("ui")
    .description("Start the local dashboard server with same-origin API routes.")
    .option("-p, --port <port>", "Port for the local dashboard server.", parsePort, DEFAULT_UI_PORT)
    .action(async ({ port }: { port: number }) => {
      const result = await launchDashboardRuntime({
        projectRoot: process.cwd(),
        host: "127.0.0.1",
        port,
        uiDistPath: bundledUiDistPath
      });

      console.log(`DevLoop UI available at ${result.url}`);
    });
}
