import { describe, expect, it } from "vitest";
import { parseFindings } from "@/lib/check/parse";

const TEXT = "3.3. The Contractor may change the fee unilaterally.\n4.3. Liability is capped at three months of fees.";

describe("parseFindings", () => {
  it("parses findings inside a markdown fence and locates quotes", () => {
    const raw = '```json\n{"findings":[{"verdict":"compliant","defect":null,"requirement":"R5","clause":"§4.3","title":"Cap","quotes":["Liability is capped at three months of fees."],"reason":"ok","confidence":0.9},{"verdict":"violation","defect":"D6","requirement":"R6","clause":"§3.3","title":"Price","quotes":["may change the fee unilaterally"],"reason":"bad","confidence":1.4}]}\n```';
    const f = parseFindings(raw, TEXT)!;
    expect(f).toHaveLength(2);
    expect(f[0].verdict).toBe("violation");
    expect(f[0].confidence).toBe(1);
    expect(f[0].exact).toBe(true);
  });

  it("fills the requirement from the defect and flags invented quotes", () => {
    const raw = '{"findings":[{"verdict":"risk","defect":"D6","quote":"the Client may change everything","reason":"x"}]}';
    const f = parseFindings(raw, TEXT)!;
    expect(f[0].requirement).toBe("R6");
    expect(f[0].exact).toBe(false);
  });

  it("returns null for non-JSON", () => {
    expect(parseFindings("sorry", TEXT)).toBeNull();
  });
});
