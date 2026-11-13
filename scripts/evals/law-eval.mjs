// Law-check eval: generated contracts with a known answer key, checked blind by the real pipeline.
//
// For each case: POST /api/generate (localized template, fixed seed) -> the contract text only goes
// to POST /api/check -> the NDJSON stream (law guess, retrieved provisions, legal findings) is
// scored against the key that never left this script.
//
// Scores: governing-law guess (overall, by visibility, confusion matrix); per L-defect recall
// (violating clause flagged by a law finding that cites the key's article); flip-trap false
// positives (lawful clause flagged); retrieval recall (key article among the provisions retrieved
// for that clause) apart from model recall; cost and latency.
//
// Usage (dev server running): node scripts/evals/law-eval.mjs [--base http://localhost:5173]
//   [--provider claude] [--concurrency 3] [--budget 1] [--only RU,DE] [--out law-latest]
import { mkdirSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const arg = (name, def) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : def);
const BASE = arg("base", "http://localhost:5173");
const PROVIDER = arg("provider", "claude");
const CONCURRENCY = Number(arg("concurrency", 3));
const BUDGET = Number(arg("budget", 1));
const ONLY = arg("only", "") ? arg("only", "").split(",") : null;
const OUT = arg("out", "law-latest");

// ----- cases: 9 per jurisdiction (3 visibilities x 3 seeds) + 4 "none" = 40 -----
const VISIBILITIES = ["explicit", "indirect", "hidden"];
const cases = [];
for (const [ji, jurisdiction] of ["RU", "DE", "EU", "US-NY"].entries()) {
  for (const [vi, visibility] of VISIBILITIES.entries()) {
    for (let k = 0; k < 3; k++) {
      const seed = 5000 + ji * 100 + vi * 10 + k;
      // Two of three favour the client: L4 and L7 only exist that way
      cases.push({ jurisdiction, visibility, seed, level: 4, beneficiary: k === 2 ? "contractor" : "client" });
    }
  }
}
for (let k = 0; k < 4; k++) cases.push({ jurisdiction: "none", visibility: "hidden", seed: 5900 + k, level: 4, beneficiary: k % 2 ? "contractor" : "client" });
const todo = ONLY ? cases.filter((c) => ONLY.includes(c.jurisdiction)) : cases;

// ----- helpers -----
const articleOf = (slotId) => slotId.replace(/@[a-z]{2}/, "").split(":").slice(0, 3).join(":");
const overlap = (a, b) => a[0] < b[1] && b[0] < a[1];
const expectedGuess = (j) => (j === "none" ? "unknown" : j);

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return res;
}

async function runCase(c) {
  const t0 = Date.now();
  const gres = await post("/api/generate", { ...c, provider: PROVIDER });
  const gen = await gres.json();
  if (!gres.ok || !gen.localized) throw new Error(`generate: ${gen.error ?? gres.status}`);
  const { contract, key } = gen.localized;
  const genMs = Date.now() - t0;

  // Blind: the check gets the contract text and the provider, nothing else
  const t1 = Date.now();
  const cres = await post("/api/check", { text: contract.text, provider: PROVIDER });
  const events = (await cres.text()).split("\n").filter(Boolean).map((l) => JSON.parse(l));
  const checkMs = Date.now() - t1;
  const law = events.filter((e) => e.type === "law").at(-1)?.law ?? null;
  const legal = events.filter((e) => e.type === "legal-finding").map((e) => e.finding);
  const findings = events.filter((e) => e.type === "finding").map((e) => e.finding);
  const done = events.find((e) => e.type === "done") ?? null;
  const error = events.find((e) => e.type === "error") ?? null;

  const entryFor = (clause) => law?.retrieved?.find((r) => r.clause === clause);
  const retrievedFor = (clause) => entryFor(clause)?.slotIds ?? [];
  const legalKey = key.defects.filter((d) => d.kind === "legal");
  const scored = legalKey.map((d) => {
    const onClause = legal.filter((f) => d.span && f.spans.some((s) => overlap(s, d.span)));
    const want = new Set(d.slotIds.map(articleOf));
    const citesKey = onClause.some((f) => f.legalBasis.some((b) => want.has(articleOf(b.slotId))));
    return {
      id: d.id,
      clause: d.clauseId,
      violatesHere: d.violatesHere,
      keySlots: d.slotIds,
      flagged: onClause.length > 0,
      // No slot in the key (e.g. NY common law): flagging the clause is enough
      caught: d.violatesHere && onClause.length > 0 && (want.size === 0 || citesKey),
      retrieved: want.size === 0 ? null : retrievedFor(d.clauseId).some((s) => want.has(articleOf(s))),
      // By channel (older runs have no channels: everything counts as vector)
      retrievedVector: want.size === 0 ? null : (entryFor(d.clauseId)?.vector ?? retrievedFor(d.clauseId)).some((s) => want.has(articleOf(s))),
      retrievedNamed: want.size === 0 ? null : (entryFor(d.clauseId)?.named ?? []).some((s) => want.has(articleOf(s))),
      cited: onClause.flatMap((f) => f.legalBasis.map((b) => b.slotId)),
    };
  });
  const keySpans = legalKey.map((d) => d.span).filter(Boolean);
  const unmatched = legal.filter((f) => !f.spans.some((s) => keySpans.some((k) => overlap(s, k))));

  return {
    case: c,
    language: key.language,
    country: key.country,
    guess: law?.guess ?? null,
    guessOk: law?.guess ? law.guess.jurisdiction === expectedGuess(c.jurisdiction) : false,
    searched: law?.searched ?? null,
    lawStatus: law?.status ?? "missing",
    norms: law?.norms ?? 0,
    legal: scored,
    unmatchedLegal: unmatched.map((f) => ({ clause: f.clause, slots: f.legalBasis.map((b) => b.slotId), title: f.title })),
    generalKey: key.defects.filter((d) => d.kind === "general").map((d) => d.id),
    generalFound: key.defects
      .filter((d) => d.kind === "general" && d.span)
      .filter((d) => findings.some((f) => f.defect === d.id && f.spans.some((s) => overlap(s, d.span))))
      .map((d) => d.id),
    costUsd: done?.costUsd ?? null,
    checkMs,
    genMs,
    error: error?.message ?? null,
  };
}

// ----- run with a small pool and a budget -----
const results = [];
let spent = 0;
let next = 0;
let stopped = false;
async function worker() {
  while (next < todo.length && !stopped) {
    const c = todo[next++];
    try {
      const r = await runCase(c);
      results.push(r);
      spent += r.costUsd ?? 0;
      const l = r.legal.map((x) => `${x.id}${x.violatesHere ? (x.caught ? "✓" : "✕") : x.flagged ? "!" : "·"}`).join(" ");
      console.log(`${String(results.length).padStart(2)}/${todo.length} ${c.jurisdiction.padEnd(5)} ${c.visibility.padEnd(8)} ${r.language} seed ${c.seed}  guess ${r.guess?.jurisdiction ?? "-"} ${r.guessOk ? "✓" : "✕"}  ${l}  $${(r.costUsd ?? 0).toFixed(4)} ${Math.round(r.checkMs / 1000)}s`);
    } catch (error) {
      results.push({ case: c, error: String(error) });
      console.log(`ERR ${c.jurisdiction} ${c.visibility} ${c.seed}: ${error}`);
    }
    if (spent >= BUDGET) {
      stopped = true;
      console.log(`budget $${BUDGET} reached, stopping`);
    }
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

// ----- scores -----
const ok = results.filter((r) => !r.error);
const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}% (${a}/${b})` : "–");
const rate = (xs, f) => ({ hit: xs.filter(f).length, total: xs.length });

const guessBy = {};
for (const v of [...VISIBILITIES, "all"]) guessBy[v] = rate(ok.filter((r) => v === "all" || r.case.visibility === v).filter((r) => r.case.jurisdiction !== "none"), (r) => r.guessOk);
const noneGuess = rate(ok.filter((r) => r.case.jurisdiction === "none"), (r) => r.guessOk);
const confusion = {};
for (const r of ok) {
  const row = (confusion[r.case.jurisdiction] ??= {});
  const g = r.guess?.jurisdiction ?? "none-run";
  row[g] = (row[g] ?? 0) + 1;
}

const legalAll = ok.flatMap((r) => r.legal.map((l) => ({ ...l, jurisdiction: r.case.jurisdiction, visibility: r.case.visibility, guessOk: r.guessOk })));
const violating = legalAll.filter((l) => l.violatesHere);
const lawful = legalAll.filter((l) => !l.violatesHere);
const perDefect = {};
for (const l of legalAll) {
  const d = (perDefect[l.id] ??= { violating: 0, caught: 0, flaggedNoCite: 0, retrievable: 0, retrieved: 0, lawful: 0, falsePositive: 0 });
  if (l.violatesHere) {
    d.violating++;
    if (l.caught) d.caught++;
    else if (l.flagged) d.flaggedNoCite++;
    if (l.retrieved !== null) {
      d.retrievable++;
      if (l.retrieved) d.retrieved++;
    }
  } else {
    d.lawful++;
    if (l.flagged) d.falsePositive++;
  }
}
const withSlots = violating.filter((l) => l.retrieved !== null);
const retrievedOnes = withSlots.filter((l) => l.retrieved);
const summary = {
  cases: ok.length,
  errors: results.length - ok.length,
  guess: { byVisibility: guessBy, none: noneGuess, confusion },
  legal: {
    recall: rate(violating, (l) => l.caught),
    recallByVisibility: Object.fromEntries(VISIBILITIES.map((v) => [v, rate(violating.filter((l) => l.visibility === v), (l) => l.caught)])),
    recallByJurisdiction: Object.fromEntries(["RU", "DE", "EU", "US-NY"].map((j) => [j, rate(violating.filter((l) => l.jurisdiction === j), (l) => l.caught)])),
    retrievalRecall: rate(withSlots, (l) => l.retrieved),
    retrievalRecallVector: rate(withSlots, (l) => l.retrievedVector),
    retrievalRecallNamed: rate(withSlots, (l) => l.retrievedNamed),
    modelRecallGivenRetrieved: rate(retrievedOnes, (l) => l.caught),
    flipFalsePositives: rate(lawful, (l) => l.flagged),
    unmatchedLegalFindings: ok.reduce((n, r) => n + r.unmatchedLegal.length, 0),
    perDefect,
  },
  general: rate(ok.flatMap((r) => r.generalKey.map((id) => r.generalFound.includes(id))), Boolean),
  costUsd: Math.round(ok.reduce((n, r) => n + (r.costUsd ?? 0), 0) * 1e4) / 1e4,
  avgCheckSec: Math.round(ok.reduce((n, r) => n + r.checkMs, 0) / Math.max(1, ok.length) / 100) / 10,
};

mkdirSync("evals/results", { recursive: true });
writeFileSync(`evals/results/${OUT}.json`, JSON.stringify({ ranAt: new Date().toISOString(), provider: PROVIDER, summary, results }, null, 2));

const r2 = (x) => pct(x.hit, x.total);
const md = [
  `# Law-check eval · ${new Date().toISOString().slice(0, 10)} · ${PROVIDER}`,
  "",
  `${summary.cases} contracts (${summary.errors} errors), $${summary.costUsd} total, ${summary.avgCheckSec} s per check.`,
  "",
  "## Governing-law guess",
  `- all: ${r2(guessBy.all)} · explicit ${r2(guessBy.explicit)} · indirect ${r2(guessBy.indirect)} · hidden ${r2(guessBy.hidden)}`,
  `- "none" contracts answered unknown: ${r2(noneGuess)}`,
  "",
  "| key \\ guess | " + ["RU", "DE", "EU", "US-NY", "unknown"].join(" | ") + " |",
  "|---|---|---|---|---|---|",
  ...Object.entries(confusion).map(([k, row]) => `| ${k} | ${["RU", "DE", "EU", "US-NY", "unknown"].map((g) => row[g] ?? 0).join(" | ")} |`),
  "",
  "## Law-specific defects",
  `- recall (flagged and cited the key's article): ${r2(summary.legal.recall)}`,
  `- by visibility: ${VISIBILITIES.map((v) => `${v} ${r2(summary.legal.recallByVisibility[v])}`).join(" · ")}`,
  `- by jurisdiction: ${Object.entries(summary.legal.recallByJurisdiction).map(([j, x]) => `${j} ${r2(x)}`).join(" · ")}`,
  `- retrieval recall (key article among provisions retrieved for the clause): ${r2(summary.legal.retrievalRecall)}`,
  `  - by channel: vector search ${r2(summary.legal.retrievalRecallVector)} · articles named by the model ${r2(summary.legal.retrievalRecallNamed)}`,
  `- model recall when the article was retrieved: ${r2(summary.legal.modelRecallGivenRetrieved)}`,
  `- flip traps flagged (false positives): ${r2(summary.legal.flipFalsePositives)}`,
  `- law findings on clauses outside the key: ${summary.legal.unmatchedLegalFindings}`,
  "",
  "| defect | violating | caught | flagged, other article | retrieved | lawful | false positives |",
  "|---|---|---|---|---|---|---|",
  ...Object.entries(perDefect)
    .sort(([a], [b]) => a.localeCompare(b, "en", { numeric: true }))
    .map(([id, d]) => `| ${id} | ${d.violating} | ${d.caught} | ${d.flaggedNoCite} | ${d.retrievable ? `${d.retrieved}/${d.retrievable}` : "–"} | ${d.lawful} | ${d.falsePositive} |`),
  "",
  `General traps D1–D7 found by the R1–R7 pass: ${r2(summary.general)}`,
  "",
];
writeFileSync(`evals/results/${OUT}.md`, md.join("\n"));
console.log("\n" + md.join("\n"));
