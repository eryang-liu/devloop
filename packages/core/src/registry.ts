import { randomUUID } from "node:crypto";
import { readFile, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { z } from "zod";
import { loadProjectConfig } from "./config.js";
import type { ProjectVcsMode } from "./git.js";
import { normalizeProjectRoot } from "./paths.js";
import {
  revisionFromLegacySha,
  revisionSchema,
  revisionTokenSchema,
  type Revision
} from "./revision.js";

const utcTimestampSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/, "Expected UTC ISO-8601 timestamp");

const nullableTimestampSchema = utcTimestampSchema.nullable().default(null);
const nullableLegacyRevisionSchema = revisionTokenSchema.nullable().default(null);
const nullableRevisionSchema = revisionSchema.nullable().default(null);
const nullableRunIdSchema = z.string().min(1).max(200).nullable().default(null);

const featureStatusSchema = z.enum([
  "never_tested",
  "changed_untested",
  "rework_untested",
  "tested",
  "failed",
  "needs-triage"
]);

export const featureStateSchema = z
  .object({
    featureId: z.string().min(1),
    status: featureStatusSchema,
    iteration: z.number().int().min(1).default(1),
    activeChecklist: z.array(z.string().min(1)).default([]),
    lastChangedAt: nullableTimestampSchema,
    lastChangedRevision: nullableRevisionSchema.optional(),
    lastChangedSha: nullableLegacyRevisionSchema.optional(),
    lastVerifiedRunId: nullableRunIdSchema,
    lastVerifiedRevision: nullableRevisionSchema.optional(),
    lastVerifiedSha: nullableLegacyRevisionSchema.optional()
  })
  .strict()
  .transform((feature) => ({
    featureId: feature.featureId,
    status: feature.status,
    iteration: feature.iteration,
    activeChecklist: feature.activeChecklist,
    lastChangedAt: feature.lastChangedAt,
    lastChangedRevision:
      feature.lastChangedRevision ?? revisionFromLegacySha(feature.lastChangedSha ?? null),
    lastVerifiedRunId: feature.lastVerifiedRunId,
    lastVerifiedRevision:
      feature.lastVerifiedRevision ?? revisionFromLegacySha(feature.lastVerifiedSha ?? null)
  }));

export const impactRecordSchema = z
  .object({
    featureId: z.string().min(1),
    confidence: z.enum(["high", "medium", "low"]),
    reasons: z.array(z.string().min(1)).default([]),
    recommendedScope: z.enum(["smoke", "impacted", "current+p0", "full"]),
    detectedAt: utcTimestampSchema,
    sourceRevision: revisionSchema.optional(),
    sourceSha: revisionTokenSchema.optional()
  })
  .strict()
  .transform((impact) => ({
    featureId: impact.featureId,
    confidence: impact.confidence,
    reasons: impact.reasons,
    recommendedScope: impact.recommendedScope,
    detectedAt: impact.detectedAt,
    sourceRevision:
      impact.sourceRevision ??
      revisionFromLegacySha(impact.sourceSha) ?? {
        kind: "snapshot" as const,
        snapshotId: "snap_000001"
      }
  }));

const snapshotFingerprintSchema = z
  .object({
    contentHash: z.string().min(1),
    size: z.number().int().min(0),
    mtimeMs: z.number().nonnegative()
  })
  .strict();

const historyBridgeSchema = z
  .object({
    fromRevision: revisionSchema,
    toRevision: revisionSchema,
    createdAt: utcTimestampSchema
  })
  .strict();

const snapshotStateSchema = z
  .object({
    sequence: z.number().int().min(0).default(0),
    files: z.record(z.string(), snapshotFingerprintSchema).default({})
  })
  .strict();

export const vcsMetadataSchema = z
  .object({
    mode: z.enum(["snapshot", "git-pending", "git"]).default("snapshot"),
    detectedAt: nullableTimestampSchema,
    gitRoot: z.string().nullable().default(null),
    headSha: nullableLegacyRevisionSchema,
    lastRevision: nullableRevisionSchema,
    historyBridge: historyBridgeSchema.nullable().default(null),
    snapshotState: snapshotStateSchema.default({
      sequence: 0,
      files: {}
    })
  })
  .strict();

export const registrySchema = z
  .object({
    version: z.literal(1),
    projectId: z.string().min(1).nullable().default(null),
    features: z.array(featureStateSchema),
    impactQueue: z.array(impactRecordSchema).default([]),
    lastSyncAt: nullableTimestampSchema,
    vcs: vcsMetadataSchema.default({
      mode: "snapshot",
      detectedAt: null,
      gitRoot: null,
      headSha: null,
      lastRevision: null,
      historyBridge: null,
      snapshotState: {
        sequence: 0,
        files: {}
      }
    })
  })
  .strict()
  .superRefine((registry, ctx) => {
    const seenFeatureIds = new Set<string>();

    for (const [index, feature] of registry.features.entries()) {
      if (seenFeatureIds.has(feature.featureId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate featureId in registry.features: ${feature.featureId}`,
          path: ["features", index, "featureId"]
        });
        continue;
      }

      seenFeatureIds.add(feature.featureId);
    }
  });

export type FeatureState = z.output<typeof featureStateSchema>;
export type ImpactRecord = z.output<typeof impactRecordSchema>;
export type VcsMetadata = z.infer<typeof vcsMetadataSchema>;
export type Registry = z.infer<typeof registrySchema>;

export function createProjectId(): string {
  return `proj_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
}

export function buildVcsMetadata(
  mode: ProjectVcsMode,
  now: string,
  current: VcsMetadata,
  revision: Revision,
  options?: {
    gitRoot?: string | null;
    headSha?: string | null;
    historyBridge?: VcsMetadata["historyBridge"];
    snapshotState?: VcsMetadata["snapshotState"];
  }
): VcsMetadata {
  return {
    mode,
    detectedAt: current.mode === mode && current.detectedAt ? current.detectedAt : now,
    gitRoot: options?.gitRoot ?? current.gitRoot,
    headSha: options?.headSha ?? current.headSha,
    lastRevision: revision,
    historyBridge: options?.historyBridge ?? current.historyBridge,
    snapshotState: options?.snapshotState ?? current.snapshotState
  };
}

export async function loadRegistry(projectRoot: string | URL): Promise<Registry> {
  const config = await loadProjectConfig(projectRoot);
  const root = normalizeProjectRoot(projectRoot);
  const raw = await readFile(join(root, config.paths.registry), "utf8");
  return registrySchema.parse(JSON.parse(raw));
}

export async function saveRegistry(projectRoot: string | URL, registry: Registry): Promise<void> {
  const config = await loadProjectConfig(projectRoot);
  const root = normalizeProjectRoot(projectRoot);
  const registryPath = join(root, config.paths.registry);
  const serialized = JSON.stringify(registrySchema.parse(registry), null, 2) + "\n";
  const tempPath = join(
    dirname(registryPath),
    `.${basename(registryPath)}.${process.pid}.${randomUUID()}.tmp`
  );

  try {
    await writeFile(tempPath, serialized, { encoding: "utf8", flag: "wx" });
    await rename(tempPath, registryPath);
  } catch (error) {
    await rm(tempPath, { force: true });
    throw error;
  }
}
