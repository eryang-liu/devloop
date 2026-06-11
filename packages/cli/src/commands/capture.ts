import { captureRequirement } from "@devloop/core";
import { Command, InvalidArgumentError } from "commander";

function normalizeCaptureSource(value: string) {
  if (value === "cli" || value === "chat") {
    return "manual" as const;
  }

  if (value === "manual" || value === "codex" || value === "cursor" || value === "claude-code") {
    return value;
  }

  throw new InvalidArgumentError(
    "source must be one of manual, cli, codex, cursor, claude-code, or chat"
  );
}

function parseConfidence(value: string): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    throw new InvalidArgumentError("confidence must be a number between 0 and 1");
  }

  return parsed;
}

export function captureCommand(): Command {
  return new Command("capture")
    .description("Capture a requirement into an iteration record and generated PRD.")
    .option("--source <source>", "Requirement source channel, defaults to manual", "manual")
    .requiredOption("--raw-request <text>", "Raw requirement text to capture")
    .option("--timestamp <iso>", "Capture timestamp in ISO-8601 format")
    .option("--title <title>", "Optional iteration title override")
    .option("--suggested-iteration-id <id>", "Optional existing iteration id to extend or reopen")
    .option(
      "--intent-type <type>",
      "Optional intent type: new_iteration, iteration_extension, regression_fix, reopen_iteration, or uncertain"
    )
    .option("--confidence <value>", "Optional intent confidence from 0 to 1", parseConfidence)
    .action(async (options) => {
      const result = await captureRequirement(process.cwd(), {
        source: normalizeCaptureSource(options.source),
        rawRequest: options.rawRequest,
        timestamp: options.timestamp ?? new Date().toISOString(),
        title: options.title,
        suggestedIterationId: options.suggestedIterationId,
        intentType: options.intentType,
        confidence: options.confidence
      });

      console.log(JSON.stringify(result, null, 2));
    });
}
