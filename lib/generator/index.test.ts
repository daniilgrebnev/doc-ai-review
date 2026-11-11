import { describe, expect, it } from "vitest";
import { generateContract } from "@/lib/generator";

describe("generateContract", () => {
  it("is reproducible by seed", () => {
    const a = generateContract({ level: 3, beneficiary: "contractor", seed: 42 });
    const b = generateContract({ level: 3, beneficiary: "contractor", seed: 42 });
    expect(a.text).toBe(b.text);
    expect(a.key).toEqual(b.key);
  });

  it("level 0 has no traps", () => {
    expect(generateContract({ level: 0, beneficiary: "client", seed: 1 }).key).toEqual([]);
  });

  it("puts exactly `level` traps and every key quote is in the text", () => {
    for (let seed = 1; seed <= 30; seed++) {
      const c = generateContract({ level: 1 + (seed % 5), beneficiary: seed % 2 ? "client" : "contractor", seed });
      expect(c.key).toHaveLength(1 + (seed % 5));
      for (const k of c.key) expect(k.spans).toHaveLength(k.quotes.length);
    }
  });

  it("respects the chosen defect types", () => {
    const c = generateContract({ level: 5, beneficiary: "contractor", defects: ["D1", "D7"], seed: 7 });
    expect(c.key.map((k) => k.defect)).toEqual(["D1", "D7"]);
  });
});
