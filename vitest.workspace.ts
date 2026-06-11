import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineWorkspace } from "vitest/config";

const workspaceRoot = dirname(fileURLToPath(import.meta.url));
const packageProjects = ["packages/core", "packages/cli", "packages/server"].filter((project) =>
  existsSync(resolve(workspaceRoot, project))
);

export default defineWorkspace(packageProjects);
