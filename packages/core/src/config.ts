import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { projectConfigSchema, type ProjectConfig } from "./types.js";

function normalizeRoot(projectRoot: string | URL): string {
  return projectRoot instanceof URL ? fileURLToPath(projectRoot) : projectRoot;
}

export async function loadProjectConfig(projectRoot: string | URL): Promise<ProjectConfig> {
  const root = normalizeRoot(projectRoot);
  const configPath = join(root, ".devloop", "config.yml");
  const raw = await readFile(configPath, "utf8");
  return projectConfigSchema.parse(parse(raw));
}
