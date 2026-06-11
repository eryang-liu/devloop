import { z } from "zod";

const normalizedUtcDatetimeSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/, "Expected UTC ISO-8601 timestamp")
  .refine((value) => {
    const timestamp = Date.parse(value);

    if (Number.isNaN(timestamp)) {
      return false;
    }

    return new Date(timestamp).toISOString() === value;
  }, "Expected a real UTC ISO-8601 timestamp");

const safePathTokenSchema = z
  .string()
  .min(1)
  .regex(/^[a-z0-9]+(?:[a-z0-9_-]*[a-z0-9])?$/i, "Expected a safe filename token")
  .refine((value) => !value.includes("/") && !value.includes("\\"), {
    message: "Path separators are not allowed"
  });

export const iterationStatusSchema = z.enum([
  "active",
  "paused",
  "done",
  "reopened",
  "archived"
]);

export const iterationSourceSchema = z.enum(["manual", "codex", "cursor", "claude-code"]);

export const checklistItemSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    type: z.enum(["acceptance", "regression"]),
    priority: z.enum(["P0", "P1", "P2"]).default("P1"),
    rationale: z.string().default(""),
    suggestedScope: z.enum(["smoke", "impacted", "current+p0", "full"]).default("impacted"),
    status: z.enum(["pending", "in_progress", "verified", "failed", "waived"]).default("pending"),
    evidenceLinks: z.array(z.string()).default([])
  })
  .strict();

export const changeEventSchema = z
  .object({
    id: safePathTokenSchema,
    source: iterationSourceSchema,
    timestamp: normalizedUtcDatetimeSchema,
    rawRequest: z.string().min(1),
    contextSummary: z.string().default(""),
    intentType: z.enum([
      "new_iteration",
      "iteration_extension",
      "regression_fix",
      "reopen_iteration",
      "uncertain"
    ]),
    confidence: z.number().min(0).max(1),
    conversationId: z.string().nullable().default(null)
  })
  .strict();

export const iterationRecordSchema = z
  .object({
    id: safePathTokenSchema,
    slug: safePathTokenSchema,
    title: z.string().min(1),
    status: iterationStatusSchema,
    source: iterationSourceSchema,
    createdAt: normalizedUtcDatetimeSchema,
    updatedAt: normalizedUtcDatetimeSchema,
    closedAt: normalizedUtcDatetimeSchema.nullable().default(null),
    reopenedFrom: z.string().nullable().default(null),
    rawUserIntent: z.string().min(1),
    goal: z.string().default(""),
    nonGoals: z.array(z.string()).default([]),
    acceptanceItems: z.array(checklistItemSchema).default([]),
    regressionItems: z.array(checklistItemSchema).default([]),
    affectedFeatures: z.array(z.string()).default([]),
    affectedPaths: z.array(z.string()).default([]),
    changeEvents: z.array(changeEventSchema).default([]),
    testRunIds: z.array(z.string()).default([]),
    evidenceLinks: z.array(z.string()).default([]),
    releaseStatus: z.enum(["unknown", "pass", "warn", "block"]).default("unknown"),
    conversationRefs: z.array(z.string()).default([])
  })
  .superRefine((iteration, ctx) => {
    for (const [index, item] of iteration.acceptanceItems.entries()) {
      if (item.type !== "acceptance") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "acceptanceItems must only contain acceptance-typed checklist items",
          path: ["acceptanceItems", index, "type"]
        });
      }
    }

    for (const [index, item] of iteration.regressionItems.entries()) {
      if (item.type !== "regression") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "regressionItems must only contain regression-typed checklist items",
          path: ["regressionItems", index, "type"]
        });
      }
    }
  })
  .strict();

export type IterationRecord = z.infer<typeof iterationRecordSchema>;
