import { describe, expect, it } from "vitest";
import { formatModelLabel, resolveEffort } from "@/lib/claude/models";

describe("formatModelLabel", () => {
  it("labels versioned models", () => {
    expect(formatModelLabel("claude-opus-5-5")).toBe("Claude Opus 5.5");
    expect(formatModelLabel("claude-sonnet-5-5")).toBe("Claude Sonnet 5.5");
  });

  it("labels models without minor version", () => {
    expect(formatModelLabel("claude-opus-5")).toBe("Claude Opus 5");
  });

  it("keeps unknown ids as is", () => {
    expect(formatModelLabel("custom-model")).toBe("custom-model");
  });

  it("labels demo", () => {
    expect(formatModelLabel("demo")).toBe("Demo");
  });
});

describe("resolveEffort", () => {
  it("accepts valid values case-insensitively", () => {
    expect(resolveEffort("HIGH", "medium")).toBe("high");
  });

  it("falls back on invalid or empty values", () => {
    expect(resolveEffort("turbo", "medium")).toBe("medium");
    expect(resolveEffort(undefined, "low")).toBe("low");
  });
});
