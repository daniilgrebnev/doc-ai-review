import { describe, expect, it, afterEach } from "vitest";
import { isDemoMode } from "@/lib/demo/is-demo-mode";
import { getDemoAnalyzeResult, getDemoReviseResult, SAMPLE_CONTRACT_TEXT } from "@/lib/demo/sample-contract";

describe("isDemoMode", () => {
  const originalKey = process.env.ANTHROPIC_API_KEY;

  afterEach(() => {
    if (originalKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = originalKey;
  });

  it("returns true when API key missing", () => {
    delete process.env.ANTHROPIC_API_KEY;
    expect(isDemoMode()).toBe(true);
  });

  it("returns false when API key set", () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    expect(isDemoMode()).toBe(false);
  });
});

describe("sample contract demo data", () => {
  it("has contract text long enough", () => {
    expect(SAMPLE_CONTRACT_TEXT.trim().length).toBeGreaterThan(100);
  });

  it("returns results for all agents", () => {
    const lawyer = getDemoAnalyzeResult("lawyer");
    const pm = getDemoAnalyzeResult("pm");
    expect(lawyer.status).toBe("revision");
    expect(pm.status).toBe("approved");
  });

  it("returns revised text", () => {
    const { revisedText, model } = getDemoReviseResult();
    expect(revisedText).toContain("14 календарных дней");
    expect(model).toBe("demo");
  });
});
