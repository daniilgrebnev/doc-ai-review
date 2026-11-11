import { describe, expect, it } from "vitest";
import { EXAMPLES } from "@/lib/check/examples";

describe("ready-made examples", () => {
  it("every quote is found verbatim in its contract", () => {
    for (const ex of EXAMPLES) {
      for (const f of ex.findings) {
        expect(f.exact, `${ex.id}/${f.id}`).toBe(true);
        expect(f.spans.length).toBeGreaterThanOrEqual(f.quotes.length);
      }
    }
  });

  it("includes an honest contract with no findings", () => {
    expect(EXAMPLES.some((e) => e.findings.length === 0)).toBe(true);
  });
});
