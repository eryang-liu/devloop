import { buildConsoleApp } from "@devloop/server";
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface LaunchConsoleOptions {
  projectRoot: string;
}

const DEFAULT_CONSOLE_PORT = 4301;
const DEFAULT_HOST = "127.0.0.1";
const bundledConsoleDistPath = resolve(dirname(fileURLToPath(import.meta.url)), "../../dist/console");
const bundledDashboardDistPath = resolve(dirname(fileURLToPath(import.meta.url)), "../../dist/ui");

export async function openLocalUrl(url: string): Promise<void> {
  try {
    const child =
      process.platform === "darwin"
        ? spawn("open", [url], { detached: true, stdio: "ignore" })
        : process.platform === "win32"
          ? spawn("cmd", ["/c", "start", "", url], {
              detached: true,
              stdio: "ignore",
              windowsHide: true
            })
          : spawn("xdg-open", [url], { detached: true, stdio: "ignore" });

    child.unref();
  } catch {
    // Best-effort only; the console url is still printed for manual opening.
  }
}

export async function launchConsole(options: LaunchConsoleOptions): Promise<void> {
  const app = await buildConsoleApp({
    projectRoot: options.projectRoot,
    dashboardUiDistPath: bundledDashboardDistPath,
    consoleUiDistPath: bundledConsoleDistPath
  });
  const url = await app.listen({
    host: DEFAULT_HOST,
    port: DEFAULT_CONSOLE_PORT
  });

  console.log(`DevLoop console available at ${url}`);
  await openLocalUrl(url);
}
