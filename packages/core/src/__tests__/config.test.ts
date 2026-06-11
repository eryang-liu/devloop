import { describe, expect, it } from "vitest";
import { loadProjectConfig } from "../config.js";

describe("loadProjectConfig", () => {
  it("loads the devloop project config from .devloop/config.yml", async () => {
    const config = await loadProjectConfig(new URL("./fixtures/project", import.meta.url));

    expect(config.project_name).toBe("fixture-app");
    expect(config.features).toHaveLength(2);
    expect(config.gate.require_head_smoke_pass).toBe(true);
    expect(config.gate.strict_snapshot).toBe(true);
  });
});
