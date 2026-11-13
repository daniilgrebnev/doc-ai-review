import { describe, expect, it } from "vitest";
import {
  articleOf,
  buildLawCheckMessages,
  buildPrepareMessages,
  contractClauses,
  normalizeArticle,
  parseLawFindings,
  parsePrepare,
  pickNorms,
  searchScope,
  type LawHit,
} from "@/lib/check/law";
import { generateLocalized, type Translator } from "@/lib/generator/localized";

const TEXT = `München, 1. März 2026

1. Vergütung
4.4. Der Auftragnehmer verzichtet auf jegliche Verzugszinsen für verspätete Zahlungen des Auftraggebers.
8.4. Jede Partei kann ihren Zahlungsanspruch an einen Dritten abtreten.`;

const hit = (slotId: string, distance: number): LawHit => ({ slotId, pieceId: `${slotId}#1`, articleTitle: `T ${slotId}`, text: `text of ${slotId}`, jurisdiction: "DE", distance });

describe("parsePrepare", () => {
  it("reads the guess, keeps evidence found in the text and queries for real clauses only", () => {
    const raw = JSON.stringify({
      jurisdiction: "de",
      country: "DE",
      confidence: 0.9,
      evidence: ["München, 1. März 2026", "invented fragment"],
      queries: [
        { clause: "§4.4", query: "Ist ein Verzicht auf Verzugszinsen wirksam?" },
        { clause: "9.9", query: "no such clause" },
      ],
    });
    const p = parsePrepare("```json\n" + raw + "\n```", TEXT)!;
    expect(p.guess).toEqual({ jurisdiction: "DE", country: "DE", confidence: 0.9, evidence: ["München, 1. März 2026"] });
    expect(p.queries).toEqual([{ clause: "4.4", query: "Ist ein Verzicht auf Verzugszinsen wirksam?" }]);
  });

  it("treats an unknown jurisdiction as unknown with zero confidence and searches everywhere", () => {
    const p = parsePrepare('{"jurisdiction":"FR","confidence":0.8,"queries":[]}', TEXT)!;
    expect(p.guess.jurisdiction).toBe("unknown");
    expect(searchScope(p.guess)).toEqual([]);
    expect(searchScope({ jurisdiction: "RU", country: "RU", confidence: 0.4, evidence: [] })).toEqual([]);
    expect(searchScope({ jurisdiction: "RU", country: "RU", confidence: 0.6, evidence: [] })).toEqual(["RU"]);
  });
});

describe("pickNorms", () => {
  it("dedupes by slot and keeps up to 3 per clause", () => {
    const { norms, retrieved } = pickNorms(
      [
        { clause: "4.4", query: "a" },
        { clause: "8.4", query: "b" },
      ],
      [
        [hit("de:bgb:288:6", 0.3), hit("de:bgb:288:6", 0.31), hit("de:bgb:289", 0.35), hit("de:bgb:301", 0.36), hit("de:bgb:290", 0.4)],
        [hit("de:bgb:399", 0.2), hit("de:bgb:289", 0.3)],
      ]
    );
    expect(retrieved).toEqual([
      { clause: "4.4", query: "a", slotIds: ["de:bgb:288:6", "de:bgb:289", "de:bgb:301"] },
      { clause: "8.4", query: "b", slotIds: ["de:bgb:399", "de:bgb:289"] },
    ]);
    expect(norms.map((n) => n.slotId).sort()).toEqual(["de:bgb:288:6", "de:bgb:289", "de:bgb:301", "de:bgb:399"]);
    expect(norms[0].slotId).toBe("de:bgb:399"); // closest first
  });

  it("gives every clause its best hit before anyone's third under the cap", () => {
    const queries = Array.from({ length: 30 }, (_, i) => ({ clause: `1.${i + 1}`, query: "q" }));
    // Clause 1.1 has the closest hits of all; the others are farther away
    const hits = queries.map((_, i) => [0, 1, 2].map((r) => hit(`s:${i}:${r}`, (i === 0 ? 0.1 : 0.5) + r / 100)));
    const { retrieved } = pickNorms(queries, hits);
    expect(retrieved.every((r) => r.slotIds.length >= 1)).toBe(true);
    expect(retrieved.reduce((n, r) => n + r.slotIds.length, 0)).toBe(50);
  });
});

describe("parseLawFindings", () => {
  const { norms } = pickNorms([{ clause: "4.4", query: "a" }], [[hit("de:bgb:288:6", 0.3)]]);

  it("keeps only findings citing a retrieved provision and locates quotes", () => {
    const raw = JSON.stringify({
      governingLaw: "DE",
      findings: [
        { verdict: "violation", clause: "4.4", title: "Zinsverzicht", quotes: ["verzichtet auf jegliche Verzugszinsen"], legalBasis: ["de:bgb:288:6", "de:bgb:999"], reason: "§ 288 Abs. 6", confidence: 0.9 },
        { verdict: "violation", clause: "8.4", title: "x", quotes: ["Jede Partei kann"], legalBasis: ["de:bgb:399"], reason: "not retrieved", confidence: 0.9 },
        { verdict: "compliant", clause: "8.4", quotes: [], legalBasis: ["de:bgb:288:6"] },
      ],
    });
    const p = parseLawFindings(raw, TEXT, norms)!;
    expect(p.governingLaw).toBe("DE");
    expect(p.findings).toHaveLength(1);
    expect(p.findings[0].legalBasis).toEqual([{ slotId: "de:bgb:288:6", articleTitle: "T de:bgb:288:6" }]);
    expect(p.findings[0].exact).toBe(true);
  });

  it("returns null for non-JSON", () => {
    expect(parseLawFindings("sorry", TEXT, norms)).toBeNull();
  });
});

describe("named articles", () => {
  it("normalizes ids and drops anything that is not a known law", () => {
    expect(normalizeArticle("ru:gk:333")).toBe("ru:gk:333");
    expect(normalizeArticle("DE:BGB:276")).toBe("de:bgb:276");
    expect(normalizeArticle("de:bgb:271a")).toBe("de:bgb:271a");
    expect(normalizeArticle("us-ny:ucc:2-718")).toBe("us-ny:ucc:2-718");
    expect(normalizeArticle("eu:2011-7:7")).toBe("eu:2011-7@en:7");
    expect(normalizeArticle("fr:cc:1231-5")).toBeNull();
    expect(normalizeArticle("ru:gk:333'; drop table")).toBeNull();
    const p = parsePrepare('{"jurisdiction":"DE","confidence":0.9,"queries":[{"clause":"4.4","query":"q","articles":["de:bgb:288","x","de:bgb:288"]}]}', TEXT)!;
    expect(p.queries[0].articles).toEqual(["de:bgb:288"]);
  });

  it("puts named articles first and records where each slot came from", () => {
    const { retrieved } = pickNorms([{ clause: "4.4", query: "a" }], [
      { name: "named", hits: [[hit("de:bgb:288:6", 0.4)]], take: 2 },
      { name: "question", hits: [[hit("de:bgb:289", 0.2), hit("de:bgb:288:6", 0.3)]], take: 3 },
      { name: "clause", hits: [[hit("de:bgb:301", 0.5)]], take: 1 },
    ]);
    expect(retrieved[0]).toEqual({ clause: "4.4", query: "a", slotIds: ["de:bgb:288:6", "de:bgb:289", "de:bgb:301"], named: ["de:bgb:288:6"], vector: ["de:bgb:289", "de:bgb:301"] });
  });
});

describe("helpers", () => {
  it("splits numbered clauses and compares citations by article", () => {
    expect(contractClauses(TEXT).map((c) => c.clause)).toEqual(["4.4", "8.4"]);
    expect(articleOf("ru:gk:782:1")).toBe("ru:gk:782");
    expect(articleOf("eu:2011-7@en:3:5")).toBe("eu:2011-7:3");
    expect(articleOf("eu:2011-7@de:3")).toBe("eu:2011-7:3");
  });
});

describe("blind law check", () => {
  const fake: Translator = async (units, lang) => Object.fromEntries(units.map((u) => [u.id, `[${lang}] ${u.text}`]));

  it("prepare and law-check prompts of a generated contract carry none of the answer key", async () => {
    for (const j of ["RU", "DE", "EU", "US-NY"] as const) {
      for (let seed = 1; seed <= 8; seed++) {
        const g = await generateLocalized({ jurisdiction: j, visibility: "hidden", seed, level: 5, beneficiary: seed % 2 ? "client" : "contractor" }, fake);
        const { norms, retrieved } = pickNorms([{ clause: "4.1", query: "q" }], [[hit("x:y:1", 0.1)]]);
        const prompt = JSON.stringify([...buildPrepareMessages(g.contract.text), ...buildLawCheckMessages(g.contract.text, norms, retrieved)]);
        expect(prompt).not.toMatch(/visibility|violatesHere|slotIds|"jurisdiction":"(RU|DE|EU|US-NY)"/);
        expect(prompt).not.toMatch(/\bL[1-8]\b/);
        for (const d of g.key.defects) for (const s of d.slotIds) expect(prompt).not.toContain(s);
      }
    }
  });
});
