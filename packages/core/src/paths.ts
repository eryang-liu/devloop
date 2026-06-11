import { fileURLToPath } from "node:url";

export function normalizeProjectRoot(projectRoot: string | URL): string {
  return projectRoot instanceof URL ? fileURLToPath(projectRoot) : projectRoot;
}
