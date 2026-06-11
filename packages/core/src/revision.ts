import { z } from "zod";

export const revisionTokenSchema = z
  .string()
  .regex(
    /^[A-Za-z0-9][A-Za-z0-9._-]{6,63}$/,
    "Expected a revision token with 7 to 64 URL-safe characters"
  );

export const snapshotIdSchema = z
  .string()
  .regex(/^snap_\d{6}$/, "Expected snapshot ids such as snap_000001");

export const gitRevisionSchema = z
  .object({
    kind: z.literal("git"),
    commitSha: revisionTokenSchema
  })
  .strict();

export const snapshotRevisionSchema = z
  .object({
    kind: z.literal("snapshot"),
    snapshotId: snapshotIdSchema
  })
  .strict();

export const revisionSchema = z.discriminatedUnion("kind", [
  gitRevisionSchema,
  snapshotRevisionSchema
]);

export type Revision = z.infer<typeof revisionSchema>;

export function revisionFromLegacySha(value: string | null | undefined): Revision | null {
  if (!value) {
    return null;
  }

  return {
    kind: "git",
    commitSha: value
  };
}

export function formatRevisionLabel(revision: Revision): string {
  if (revision.kind === "git") {
    return revision.commitSha;
  }

  return revision.snapshotId;
}
