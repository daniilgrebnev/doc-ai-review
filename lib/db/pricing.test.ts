import { describe, expect, it } from "vitest";
import { computeCostUsd } from "./pricing";

describe("computeCostUsd", () => {
  it("prices Claude Haiku 5.5", () => {
    expect(computeCostUsd("claude-haiku-5-5", 1_000_000, 1_000_000)).toBe(0.6);
  });
  it("prices DeepSeek", () => {
    expect(computeCostUsd("deepseek-flash", 10_000, 2_000)).toBeCloseTo(0.00196, 6);
  });
  it("returns null for unknown models", () => {
    expect(computeCostUsd("yandexgpt-5.1", 100, 100)).toBeNull();
  });
});
