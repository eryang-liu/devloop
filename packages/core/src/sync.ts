import { createHash } from "node:crypto";
import { lstat, readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { loadProjectConfig } from "./config.js";
import { buildImpactQueue } from "./impact.js";
import { detectProjectVcsState, getChangedFiles, type ProjectVcsState } from "./git.js";
import { normalizeProjectRoot } from "./paths.js";
import {
  buildVcsMetadata,
  createProjectId,
  loadRegistry,
  type FeatureState,
  type Registry
} from "./registry.js";
import type { Revision } from "./revision.js";

export type SyncInput = {
  changedFiles?: string[];
  revision?: Revision;
  vcsState?: ProjectVcsState;
  now: string;
};

type SnapshotFingerprint = Registry["vcs"]["snapshotState"]["files"][string];

async function collectTrackedFiles(projectRoot: string, trackedPaths: string[]): Promise<string[]> {
  const uniquePaths = [...new Set(trackedPaths)].sort();
  const collected = new Set<string>();

  async function walk(absolutePath: string): Promise<void> {
    let stats;

    try {
      stats = await lstat(absolutePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return;
      }

      throw error;
    }

    if (stats.isDirectory()) {
      const entries = await readdir(absolutePath, { withFileTypes: true });

      for (const entry of entries) {
        await walk(join(absolutePath, entry.name));
      }

      return;
    }

    if (!stats.isFile()) {
      return;
    }

    const relativePath = relative(projectRoot, absolutePath).replaceAll("\\", "/");
    collected.add(relativePath);
  }

  for (const trackedPath of uniquePaths) {
    await walk(join(projectRoot, trackedPath));
  }

  return [...collected].sort();
}

async function fingerprintFiles(
  projectRoot: string,
  relativePaths: string[]
): Promise<Record<string, SnapshotFingerprint>> {
  const fingerprints: Record<string, SnapshotFingerprint> = {};

  for (const relativePath of relativePaths) {
    const absolutePath = join(projectRoot, relativePath);
    const [content, stats] = await Promise.all([readFile(absolutePath), lstat(absolutePath)]);
    fingerprints[relativePath] = {
      contentHash: createHash("sha1").update(content).digest("hex"),
      size: stats.size,
      mtimeMs: stats.mtimeMs
    };
  }

  return fingerprints;
}

function fingerprintChanged(a: SnapshotFingerprint | undefined, b: SnapshotFingerprint | undefined) {
  if (!a || !b) {
    return true;
  }

  return a.contentHash !== b.contentHash || a.size !== b.size || a.mtimeMs !== b.mtimeMs;
}

function nextSnapshotId(sequence: number): `snap_${string}` {
  return `snap_${String(sequence).padStart(6, "0")}`;
}

async function captureSnapshotSync(
  projectRoot: string,
  trackedPaths: string[],
  registry: Registry
): Promise<{
  changedFiles: string[];
  revision: Revision;
  snapshotState: Registry["vcs"]["snapshotState"];
}> {
  const relativeFiles = await collectTrackedFiles(projectRoot, trackedPaths);
  const fingerprints = await fingerprintFiles(projectRoot, relativeFiles);
  const previousFiles = registry.vcs.snapshotState.files;
  const changedFiles = [...new Set([...Object.keys(previousFiles), ...Object.keys(fingerprints)])]
    .filter((filePath) => fingerprintChanged(previousFiles[filePath], fingerprints[filePath]))
    .sort();
  const sequence = registry.vcs.snapshotState.sequence + 1;

  return {
    changedFiles,
    revision: {
      kind: "snapshot",
      snapshotId: nextSnapshotId(sequence)
    },
    snapshotState: {
      sequence,
      files: fingerprints
    }
  };
}

function upgradeHistoryBridge(
  registry: Registry,
  revision: Revision,
  now: string
): Registry["vcs"]["historyBridge"] {
  if (registry.vcs.historyBridge) {
    return registry.vcs.historyBridge;
  }

  const previousRevision = registry.vcs.lastRevision;

  if (!previousRevision || previousRevision.kind !== "snapshot") {
    return null;
  }

  return {
    fromRevision: previousRevision,
    toRevision: revision,
    createdAt: now
  };
}

export async function syncProject(
  projectRoot: string | URL,
  input: SyncInput
): Promise<Registry> {
  const root = normalizeProjectRoot(projectRoot);
  const [config, registry, detectedVcsState] = await Promise.all([
    loadProjectConfig(projectRoot),
    loadRegistry(projectRoot),
    input.vcsState ? Promise.resolve(input.vcsState) : detectProjectVcsState(projectRoot)
  ]);
  const trackedPaths = config.features.flatMap((feature) => feature.paths);

  let changedFiles = input.changedFiles;
  let revision = input.revision;
  let snapshotState = registry.vcs.snapshotState;

  if (!changedFiles || !revision) {
    if (detectedVcsState.mode === "git") {
      changedFiles = changedFiles ?? (await getChangedFiles(projectRoot));
      revision =
        revision ??
        ({
          kind: "git",
          commitSha: detectedVcsState.headSha ?? "unknown000"
        } satisfies Revision);
    } else {
      const snapshotCapture = await captureSnapshotSync(root, trackedPaths, registry);
      changedFiles = changedFiles ?? snapshotCapture.changedFiles;
      revision = revision ?? snapshotCapture.revision;
      snapshotState = snapshotCapture.snapshotState;
    }
  }

  const impactQueue = buildImpactQueue(config.features, changedFiles, input.now, revision);
  const impactedFeatureIds = new Set(impactQueue.map((item) => item.featureId));
  const existingFeatureIds = new Set(registry.features.map((feature) => feature.featureId));

  const features: FeatureState[] = registry.features.map((feature) => {
    if (!impactedFeatureIds.has(feature.featureId)) {
      return feature;
    }

    return {
      ...feature,
      status: "changed_untested",
      lastChangedAt: input.now,
      lastChangedRevision: revision
    };
  });

  for (const feature of config.features) {
    if (!impactedFeatureIds.has(feature.id) || existingFeatureIds.has(feature.id)) {
      continue;
    }

    features.push({
      featureId: feature.id,
      status: "changed_untested",
      iteration: 1,
      activeChecklist: [],
      lastChangedAt: input.now,
      lastChangedRevision: revision,
      lastVerifiedRunId: null,
      lastVerifiedRevision: null
    });
  }

  const historyBridge =
    detectedVcsState.mode === "git" ? upgradeHistoryBridge(registry, revision, input.now) : null;

  return {
    ...registry,
    projectId: registry.projectId ?? createProjectId(),
    features,
    impactQueue,
    lastSyncAt: input.now,
    vcs: buildVcsMetadata(detectedVcsState.mode, input.now, registry.vcs, revision, {
      gitRoot: detectedVcsState.gitRoot,
      headSha: detectedVcsState.headSha,
      historyBridge,
      snapshotState
    })
  };
}
