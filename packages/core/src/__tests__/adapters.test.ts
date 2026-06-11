import { describe, expect, it } from "vitest";
import { normalizeAdapterEvent } from "../adapters.js";

describe("normalizeAdapterEvent", () => {
  it("normalizes Codex payloads into the shared capture model", () => {
    expect(
      normalizeAdapterEvent("codex", {
        conversationId: "conv_1",
        userMessage: "新增一个需求自动生成 PRD 的入口"
      })
    ).toMatchObject({
      source: "codex",
      conversationId: "conv_1",
      rawRequest: "新增一个需求自动生成 PRD 的入口"
    });
  });

  it("normalizes Cursor and Claude Code payload shapes", () => {
    expect(
      normalizeAdapterEvent("cursor", {
        conversationId: "cursor_1",
        prompt: "Refactor the upload flow"
      })
    ).toMatchObject({
      source: "cursor",
      conversationId: "cursor_1",
      rawRequest: "Refactor the upload flow"
    });

    expect(
      normalizeAdapterEvent("claude-code", {
        conversationId: "claude_1",
        userPrompt: "Fix the regression in the locale toggle"
      })
    ).toMatchObject({
      source: "claude-code",
      conversationId: "claude_1",
      rawRequest: "Fix the regression in the locale toggle"
    });
  });
});
