import { describe, expect, it, afterEach } from "vitest";
import { isDemoMode } from "@/lib/demo/is-demo-mode";
import { getDemoAnalyzeResult, getDemoReviseResult, SAMPLE_CONTRACT_TEXT } from "@/lib/demo/sample-contract";

describe("isDemoMode", () => {
  const originalKey = process.env.YC_API_KEY;
  const originalFolder = process.env.YC_FOLDER_ID;

  afterEach(() => {
    process.env.YC_API_KEY = originalKey;
    process.env.YC_FOLDER_ID = originalFolder;
  });

  it("returns true when credentials missing", () => {
    delete process.env.YC_API_KEY;
    delete process.env.YC_FOLDER_ID;
    expect(isDemoMode()).toBe(true);
  });

  it("returns false when credentials set", () => {
    process.env.YC_API_KEY = "test-key";
    process.env.YC_FOLDER_ID = "b1gtest";
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
