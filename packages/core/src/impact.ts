import { posix } from "node:path";
import type { ImpactRecord as RegistryImpactRecord } from "./registry.js";
import type { Revision } from "./revision.js";
import type { FeatureConfig } from "./types.js";

export type ImpactRecord = RegistryImpactRecord;

function normalizePathSegments(pathValue: string): string[] {
  const normalized = posix
    .normalize(pathValue.replaceAll("\\", "/"))
    .replace(/^\.\/+/, "")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");

  if (normalized === "." || normalized === "") {
    return [];
  }

  return normalized.split("/").filter(Boolean);
}

function endsWithSegments(pathSegments: string[], suffixSegments: string[]): boolean {
  if (suffixSegments.length === 0 || pathSegments.length < suffixSegments.length) {
    return false;
  }

  const offset = pathSegments.length - suffixSegments.length;

  return suffixSegments.every((segment, index) => pathSegments[offset + index] === segment);
}

function getMatchedFiles(feature: FeatureConfig, changedFiles: string[]): string[] {
  const featurePathSegments = feature.paths.map((featurePath) => normalizePathSegments(featurePath));

  return changedFiles.filter((changedFile) => {
    const changedSegments = normalizePathSegments(changedFile);

    return featurePathSegments.some((segments) => endsWithSegments(changedSegments, segments));
  });
}

export function buildImpactQueue(
  features: FeatureConfig[],
  changedFiles: string[],
  now: string,
  revision: Revision
): ImpactRecord[] {
  return features.flatMap((feature) => {
    const matchedFiles = getMatchedFiles(feature, changedFiles);

    if (matchedFiles.length === 0) {
      return [];
    }

    return [
      {
        featureId: feature.id,
        confidence: feature.priority === "P0" ? "high" : "medium",
        reasons: matchedFiles.map((file) => `matched:${file}`),
        recommendedScope: feature.priority === "P0" ? "current+p0" : "impacted",
        detectedAt: now,
        sourceRevision: revision
      }
    ];
  });
}
