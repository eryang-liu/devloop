import { buildServer } from "./app.js";

export type LaunchDashboardRuntimeOptions = {
  projectRoot: string | URL;
  uiDistPath: string;
  host?: string;
  port?: number;
};

export type LaunchDashboardRuntimeResult = {
  url: string;
  reusedExisting: boolean;
};

type ActiveDashboardRuntime = {
  host: string;
  port: number;
  projectRoot: string | URL;
  uiDistPath: string;
  url: string;
  close: () => Promise<void>;
};

let activeRuntime: ActiveDashboardRuntime | null = null;

export async function launchDashboardRuntime(
  input: LaunchDashboardRuntimeOptions
): Promise<LaunchDashboardRuntimeResult> {
  if (!input.uiDistPath) {
    throw new Error("Dashboard UI assets are unavailable.");
  }

  const host = input.host ?? "127.0.0.1";
  const port = input.port ?? 4300;

  if (
    activeRuntime &&
    activeRuntime.host === host &&
    activeRuntime.port === port &&
    activeRuntime.projectRoot === input.projectRoot &&
    activeRuntime.uiDistPath === input.uiDistPath
  ) {
    return {
      url: activeRuntime.url,
      reusedExisting: true
    };
  }

  if (activeRuntime) {
    throw new Error(`Dashboard runtime already running at ${activeRuntime.url}`);
  }

  const app = await buildServer({
    projectRoot: input.projectRoot,
    uiDistPath: input.uiDistPath
  });
  const url = await app.listen({
    host,
    port
  });

  activeRuntime = {
    host,
    port,
    projectRoot: input.projectRoot,
    uiDistPath: input.uiDistPath,
    url,
    close: () => app.close()
  };

  return {
    url,
    reusedExisting: false
  };
}

export function resetDashboardRuntimeForTests() {
  activeRuntime = null;
}

export async function shutdownDashboardRuntimeForTests() {
  if (activeRuntime) {
    await activeRuntime.close();
  }

  activeRuntime = null;
}
