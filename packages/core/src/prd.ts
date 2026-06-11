import { randomUUID } from "node:crypto";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { loadProjectConfig } from "./config.js";
import type { IterationRecord } from "./iteration-types.js";
import { normalizeProjectRoot } from "./paths.js";

function renderChecklist(items: Array<{ title: string }>, emptyLine: string): string[] {
  return items.length > 0 ? items.map((item) => `- [ ] ${item.title}`) : [emptyLine];
}

function renderBulletSection(items: string[], emptyLine: string): string[] {
  return items.length > 0 ? items.map((item) => `- ${item}`) : [emptyLine];
}

async function writeAtomicPrd(filePath: string, content: string): Promise<void> {
  const tempPath = join(
    dirname(filePath),
    `.${basename(filePath)}.${process.pid}.${randomUUID()}.tmp`
  );

  try {
    await writeFile(tempPath, content, { encoding: "utf8", flag: "wx" });
    await rename(tempPath, filePath);
  } catch (error) {
    await rm(tempPath, { force: true });
    throw error;
  }
}

export function renderIterationPrd(iteration: IterationRecord): string {
  return [
    `# ${iteration.title}`,
    "",
    `- Iteration ID: \`${iteration.id}\``,
    `- Status: \`${iteration.status}\``,
    `- Source: \`${iteration.source}\``,
    `- Created At: \`${iteration.createdAt}\``,
    `- Updated At: \`${iteration.updatedAt}\``,
    "",
    "## Original User Intent",
    "",
    iteration.rawUserIntent,
    "",
    "## Goal",
    "",
    iteration.goal || "_Pending AI summary_",
    "",
    "## Non-Goals",
    "",
    ...renderBulletSection(iteration.nonGoals, "No non-goals recorded"),
    "",
    "## Affected Areas",
    "",
    ...renderBulletSection(iteration.affectedPaths, "No affected paths recorded"),
    "",
    "## Acceptance Checklist",
    "",
    ...renderChecklist(iteration.acceptanceItems, "- [ ] Pending checklist generation"),
    "",
    "## Regression Checklist",
    "",
    ...renderChecklist(iteration.regressionItems, "- [ ] Pending regression generation"),
    ""
  ].join("\n");
}

export async function writeIterationPrd(
  projectRoot: string | URL,
  iteration: IterationRecord
): Promise<string> {
  const config = await loadProjectConfig(projectRoot);
  const root = normalizeProjectRoot(projectRoot);
  const datePrefix = iteration.createdAt.slice(0, 10);
  const prdPath = join(root, config.paths.prd_root, datePrefix, `${iteration.slug}.md`);

  await mkdir(dirname(prdPath), { recursive: true });
  await writeAtomicPrd(prdPath, renderIterationPrd(iteration));

  return prdPath;
}
