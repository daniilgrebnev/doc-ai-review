import { describe, expect, it } from "vitest";
import { buildCheckMessages, pickCheckInput } from "@/lib/check/prompt";
import { JURISDICTIONS, VISIBILITIES, type Jurisdiction, type Visibility } from "@/lib/generator/jurisdictions";
import { LEGAL_DEFECTS } from "@/lib/generator/legal-defects";
import { buildLocalizedBase, generateLocalized, type LocalizedParams, type Translator } from "@/lib/generator/localized";
import { numbersKept } from "@/lib/generator/translate";

/** Fake translator: marks every unit, keeps the rest, so tests need no model */
const fake: Translator = async (units, lang) => Object.fromEntries(units.map((u) => [u.id, `[${lang}] ${u.text}`]));

const params = (j: Jurisdiction, v: Visibility, seed: number, level = 5): LocalizedParams => ({
  jurisdiction: j,
  visibility: v,
  seed,
  level,
  beneficiary: seed % 2 ? "client" : "contractor",
});

describe("generateLocalized", () => {
  it("is reproducible by seed", async () => {
    const a = await generateLocalized(params("EU", "hidden", 11), fake);
    const b = await generateLocalized(params("EU", "hidden", 11), fake);
    expect(a).toEqual(b);
  });

  it("plants `level` clauses and every key entry points to its clause in the text", async () => {
    for (const j of JURISDICTIONS) {
      for (const v of VISIBILITIES) {
        for (let seed = 1; seed <= 12; seed++) {
          const level = seed % 6;
          const g = await generateLocalized(params(j, v, seed, level), fake);
          expect(g.key.level).toBe(level);
          // one key item per planted clause, plus legal annotations of general traps
          const planted = new Set(g.key.defects.filter((d) => d.kind === "general" || !LEGAL_DEFECTS.find((l) => l.id === d.id)?.general).map((d) => d.id));
          expect(planted.size).toBe(level);
          for (const d of g.key.defects) {
            expect(d.span, `${j}/${v}/${seed} ${d.id}`).not.toBeNull();
            expect(g.contract.text.slice(...d.span!)).toBe(d.quote);
            expect(g.contract.clauses.find((c) => c.id === d.clauseId)?.text).toBe(d.quote);
            for (const a of d.also ?? []) expect(a.span).not.toBeNull();
          }
        }
      }
    }
  });

  it("jurisdiction none: English, no governing law, no legal defects, no place cues", async () => {
    for (let seed = 1; seed <= 20; seed++) {
      const g = await generateLocalized(params("none", "explicit", seed));
      expect(g.key.language).toBe("en");
      expect(g.key.visibility).toBe("hidden");
      expect(g.key.defects.every((d) => d.kind === "general")).toBe(true);
      expect(g.key.cues).toEqual([]);
      expect(g.contract.text).not.toMatch(/governed by/);
    }
  });

  it("visibility controls the cues", () => {
    const explicit = buildLocalizedBase(params("DE", "explicit", 3));
    const indirect = buildLocalizedBase(params("DE", "indirect", 3));
    const hidden = buildLocalizedBase(params("DE", "hidden", 3));
    const types = (b: typeof explicit) => new Set(b.cues.map((c) => c.type));
    expect(types(explicit)).toContain("governing-law");
    expect(types(indirect)).not.toContain("governing-law");
    expect(types(indirect)).toContain("registration-id");
    expect(types(indirect)).toContain("currency");
    expect(Array.from(types(hidden))).toEqual(["language"]);
    const hiddenText = hidden.units.map((u) => u.text).join("\n");
    expect(hiddenText).not.toMatch(/EUR|GmbH|HRB|Munich|Hamburg|Cologne|Frankfurt|Germany/);
  });

  it("EU picks a broad mix of languages from the seed", () => {
    const langs = new Set<string>();
    for (let seed = 1; seed <= 200; seed++) langs.add(buildLocalizedBase(params("EU", "hidden", seed)).country.lang);
    expect(langs.size).toBeGreaterThan(15);
  });

  it("never plants a legal defect without a verdict for the jurisdiction or against its beneficiary", () => {
    for (const j of ["RU", "DE", "EU", "US-NY"] as const) {
      for (let seed = 1; seed <= 60; seed++) {
        const b = buildLocalizedBase(params(j, "indirect", seed));
        for (const p of b.planted.filter((x) => x.id.startsWith("L"))) {
          const d = LEGAL_DEFECTS.find((l) => l.id === p.id)!;
          expect(d.verdicts[j]).toBeDefined();
          if (d.beneficiary) expect(d.beneficiary).toBe(b.params.beneficiary);
        }
      }
    }
  });

  it("requires a translator for non-English contracts", async () => {
    await expect(generateLocalized(params("RU", "explicit", 1))).rejects.toThrow(/translator/);
  });
});

describe("blind checking", () => {
  it("the check prompt of a generated contract carries none of the answer key", async () => {
    for (const j of JURISDICTIONS) {
      for (let seed = 1; seed <= 10; seed++) {
        const g = await generateLocalized(params(j, "explicit", seed), fake);
        // Whatever the client sends along, the check route keeps only text and provider
        const input = pickCheckInput({ text: g.contract.text, provider: "claude", ...g.key, key: g.key });
        expect(Object.keys(input).sort()).toEqual(["provider", "text"]);
        const prompt = JSON.stringify(buildCheckMessages(input.text));
        expect(prompt).not.toMatch(/jurisdiction|visibility|violatesHere|slotIds/i);
        expect(prompt).not.toMatch(/\bL[1-8]\b/);
        expect(prompt).not.toMatch(/\b(ru|de|eu|us-ny):[a-z0-9-]+(@[a-z]+)?:/);
        for (const d of g.key.defects) for (const s of d.slotIds) expect(prompt).not.toContain(s);
        if (j !== "none") expect(prompt).not.toContain(`"${j}"`);
      }
    }
  });
});

describe("catalog", () => {
  it("has unique ids and well-formed slot ids", () => {
    expect(new Set(LEGAL_DEFECTS.map((d) => d.id)).size).toBe(LEGAL_DEFECTS.length);
    for (const d of LEGAL_DEFECTS) {
      expect(Boolean(d.general) !== Boolean(d.rigged && d.clean)).toBe(true);
      for (const v of Object.values(d.verdicts)) {
        for (const s of v!.slotIds) expect(s).toMatch(/^(ru:gk|de:bgb|us-ny:(ucc|gob)|eu:[0-9-]+@(\{lang\}|en|de)):[0-9a-z.:-]+$/);
      }
    }
  });
});

describe("numbersKept", () => {
  it("accepts local number formats and catches a changed number", () => {
    expect(numbersKept("The fee is EUR 3,200 per month.", "Die Vergütung beträgt EUR 3.200 monatlich.")).toBe(true);
    expect(numbersKept("RUB 150,000 within 120 days", "150 000 руб. в течение 120 дней")).toBe(true);
    expect(numbersKept("within 120 calendar days", "within 60 calendar days")).toBe(false);
  });
});
