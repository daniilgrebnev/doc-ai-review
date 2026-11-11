import { describe, expect, it } from "vitest";
import { formatModelLabel } from "@/lib/llm/model-label";

describe("formatModelLabel", () => {
  it("labels both providers", () => {
    expect(formatModelLabel("claude-haiku-5-5")).toBe("Claude Haiku 5.5");
    expect(formatModelLabel("yandexgpt-5.1")).toBe("YandexGPT 5.1");
    expect(formatModelLabel("demo")).toBe("Demo");
  });
});
