import { z } from "zod";

export const featureConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  priority: z.enum(["P0", "P1", "P2"]),
  tags: z.array(z.string()).default([]),
  paths: z.array(z.string()),
  specs: z.array(z.string()).default([]),
  scenarios: z.array(z.string()).default([]),
  invariants: z.array(z.string()).default([])
});

export const projectConfigSchema = z.object({
  version: z.literal(1),
  project_name: z.string(),
  paths: z.object({
    registry: z.string(),
    prd_root: z.string(),
    scenarios: z.string(),
    test_runs: z.string(),
    releases: z.string()
  }),
  impact: z.object({
    use_import_graph: z.boolean().default(false),
    fallback_to_paths: z.boolean().default(true),
    low_confidence_requires_triage: z.boolean().default(true)
  }),
  gate: z.object({
    block_on_p0_untested: z.boolean().default(true),
    require_head_smoke_pass: z.boolean().default(true),
    require_scenario_for_p0: z.boolean().default(true),
    strict_snapshot: z.boolean().default(true)
  }),
  test: z.object({
    smoke_scenarios: z.array(z.string()).default([])
  }),
  features: z.array(featureConfigSchema)
});

export type ProjectConfig = z.infer<typeof projectConfigSchema>;
export type FeatureConfig = z.infer<typeof featureConfigSchema>;
