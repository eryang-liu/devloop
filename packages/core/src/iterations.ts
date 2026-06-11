import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { loadProjectConfig } from "./config.js";
import { iterationRecordSchema, type IterationRecord } from "./iteration-types.js";
import { normalizeProjectRoot } from "./paths.js";

type CreateIterationRecordInput = {
  title: string;
  source: IterationRecord["source"];
  rawUserIntent: string;
  createdAt: string;
};

type IterationIndexEntry = Pick<
  IterationRecord,
  "id" | "slug" | "title" | "status" | "updatedAt" | "source"
>;

const iterationIdSchema = iterationRecordSchema.shape.id;

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function sortIterationsByUpdatedAt<T extends { updatedAt: string }>(iterations: T[]): T[] {
  return iterations
    .slice()
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

async function getIterationsDir(projectRoot: string | URL): Promise<string> {
  const config = await loadProjectConfig(projectRoot);
  const root = normalizeProjectRoot(projectRoot);
  return join(root, dirname(config.paths.registry), "iterations");
}

async function writeAtomicJson(filePath: string, payload: unknown): Promise<void> {
  const tempPath = join(
    dirname(filePath),
    `.${basename(filePath)}.${process.pid}.${randomUUID()}.tmp`
  );

  try {
    await writeFile(tempPath, JSON.stringify(payload, null, 2) + "\n", { encoding: "utf8", flag: "wx" });
    await rename(tempPath, filePath);
  } catch (error) {
    await rm(tempPath, { force: true });
    throw error;
  }
}

export function createIterationRecord(input: CreateIterationRecordInput): IterationRecord {
  return iterationRecordSchema.parse({
    id: `iter_${randomUUID().replaceAll("-", "").slice(0, 12)}`,
    slug: slugify(input.title) || "iteration",
    title: input.title,
    status: "active",
    source: input.source,
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
    closedAt: null,
    reopenedFrom: null,
    rawUserIntent: input.rawUserIntent,
    goal: "",
    nonGoals: [],
    acceptanceItems: [],
    regressionItems: [],
    affectedFeatures: [],
    affectedPaths: [],
    changeEvents: [],
    testRunIds: [],
    evidenceLinks: [],
    releaseStatus: "unknown",
    conversationRefs: []
  });
}

export async function saveIteration(
  projectRoot: string | URL,
  iteration: IterationRecord
): Promise<void> {
  const dir = await getIterationsDir(projectRoot);
  const parsed = iterationRecordSchema.parse(iteration);
  const filePath = join(dir, `${parsed.id}.json`);

  await mkdir(dir, { recursive: true });
  await writeAtomicJson(filePath, parsed);
}

export async function loadIteration(
  projectRoot: string | URL,
  iterationId: string
): Promise<IterationRecord> {
  const dir = await getIterationsDir(projectRoot);
  const safeIterationId = iterationIdSchema.parse(iterationId);
  const raw = await readFile(join(dir, `${safeIterationId}.json`), "utf8");
  return iterationRecordSchema.parse(JSON.parse(raw));
}

export async function saveIterationIndex(
  projectRoot: string | URL,
  iterations: IterationRecord[]
): Promise<void> {
  const dir = await getIterationsDir(projectRoot);
  const indexPath = join(dir, "index.json");
  const payload: IterationIndexEntry[] = sortIterationsByUpdatedAt(
    iterations.map((iteration) => iterationRecordSchema.parse(iteration))
  ).map((iteration) => ({
    id: iteration.id,
    slug: iteration.slug,
    title: iteration.title,
    status: iteration.status,
    updatedAt: iteration.updatedAt,
    source: iteration.source
  }));

  await mkdir(dir, { recursive: true });
  await writeAtomicJson(indexPath, payload);
}

export async function listIterations(projectRoot: string | URL): Promise<IterationRecord[]> {
  const dir = await getIterationsDir(projectRoot);

  let files: string[];

  try {
    files = await readdir(dir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw error;
  }

  const records = await Promise.all(
    files
      .filter((fileName) => fileName.endsWith(".json") && fileName !== "index.json")
      .map((fileName) => loadIteration(projectRoot, fileName.replace(/\.json$/, "")))
  );

  return sortIterationsByUpdatedAt(records);
}
