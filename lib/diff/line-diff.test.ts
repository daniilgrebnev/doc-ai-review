import { describe, expect, it } from "vitest";
import { computeLineDiff } from "@/lib/diff/line-diff";

describe("computeLineDiff", () => {
  it("detects added and removed lines", () => {
    const before = "line one\nline two\nline three";
    const after = "line one\nline TWO\nline four";
    const diff = computeLineDiff(before, after);

    expect(diff.some((l) => l.type === "removed" && l.text === "line two")).toBe(true);
    expect(diff.some((l) => l.type === "added" && l.text === "line TWO")).toBe(true);
    expect(diff.some((l) => l.type === "same" && l.text === "line one")).toBe(true);
  });

  it("returns all same for identical text", () => {
    const text = "a\nb\nc";
    const diff = computeLineDiff(text, text);
    expect(diff.every((l) => l.type === "same")).toBe(true);
  });
});
