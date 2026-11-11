import { describe, expect, it } from "vitest";
import { parseGeneration, planGeneration } from "@/lib/generator/llm";

const body = "1. Subject\n1.1. The Contractor provides services.\n".repeat(6);

describe("planGeneration", () => {
  it("is deterministic and respects level and chosen defects", () => {
    const a = planGeneration({ level: 3, beneficiary: "client", seed: 5 });
    expect(a).toEqual(planGeneration({ level: 3, beneficiary: "client", seed: 5 }));
    expect(a.defects).toHaveLength(3);
    expect(planGeneration({ level: 5, beneficiary: "client", defects: ["D1", "D7"], seed: 1 }).defects).toEqual(["D1", "D7"]);
  });
});

describe("parseGeneration", () => {
  const plan = planGeneration({ level: 2, beneficiary: "contractor", defects: ["D1", "D4"], seed: 1 });

  it("keeps only traps whose quotes are found in the text", () => {
    const text = `${body}4.1. The Client pays a penalty of 1% of the annual fee per day.`;
    const raw = "Here you go:\n" + JSON.stringify({
      title: "SERVICE AGREEMENT No. 7",
      text,
      traps: [
        { defect: "D1", quotes: ["The Client pays a penalty of 1% of the annual fee per day."] },
        { defect: "D4", quotes: ["within a reasonable time"] },
      ],
    });
    const parsed = parseGeneration(raw, plan)!;
    expect(parsed.contract.key.map((k) => k.defect)).toEqual(["D1"]);
    expect(parsed.missing).toEqual(["D4"]);
    expect(parsed.contract.key[0].spans).toHaveLength(1);
  });

  it("returns null for non-JSON or too short text", () => {
    expect(parseGeneration("no json", plan)).toBeNull();
    expect(parseGeneration(JSON.stringify({ text: "short" }), plan)).toBeNull();
  });
});
