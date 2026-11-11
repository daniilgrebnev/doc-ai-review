import { describe, expect, it, afterEach } from "vitest";
import { isDemoMode } from "@/lib/demo/is-demo-mode";
import { getDemoAnalyzeResult, getDemoReviseResult, SAMPLE_CONTRACT_TEXT } from "@/lib/demo/sample-contract";

describe("isDemoMode", () => {
  const keys = ["ANTHROPIC_API_KEY", "YC_API_KEY", "YC_FOLDER_ID"] as const;
  const original = keys.map((k) => process.env[k]);

  afterEach(() => {
    keys.forEach((k, i) => {
      if (original[i] === undefined) delete process.env[k];
      else process.env[k] = original[i];
    });
  });

  it("returns true when no API keys configured", () => {
    keys.forEach((k) => delete process.env[k]);
    expect(isDemoMode()).toBe(true);
  });

  it("returns false when only YandexGPT configured", () => {
    delete process.env.ANTHROPIC_API_KEY;
    process.env.YC_API_KEY = "k";
    process.env.YC_FOLDER_ID = "f";
    expect(isDemoMode()).toBe(false);
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
