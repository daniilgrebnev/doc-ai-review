// Retrieval eval for the law RAG: does the right article land in the top 5 pieces?
// Compares full-text (tsvector), vector (bge-m3 + pgvector) and hybrid (Reciprocal Rank Fusion).
// Cases: data/laws/eval/retrieval.json — a contract clause, its jurisdiction and the articles
// that should be found (slot_id prefixes; "@lang" in EU ids is ignored).
//
// Usage: node --env-file=.env.local scripts/laws/eval-retrieval.mjs [--local] [--k 5]
//   query vectors come from EMBED_URL (the server) or, with --local, from Ollama on this Mac.
import { neon } from "@neondatabase/serverless";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const args = process.argv.slice(2);
const local = args.includes("--local");
const K = args.includes("--k") ? Number(args[args.indexOf("--k") + 1]) : 5;
const POOL = 30; // candidates per method before fusion
const MODEL = process.env.EMBED_MODEL || "bge-m3";
const sql = neon(process.env.DATABASE_URL);
const cases = JSON.parse(readFileSync("data/laws/eval/retrieval.json", "utf8"));

async function embed(texts) {
  const url = local ? "http://localhost:11434/api/embed" : process.env.EMBED_URL;
  const headers = { "Content-Type": "application/json" };
  if (!local) headers.Authorization = `Bearer ${process.env.EMBED_API_KEY}`;
  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify({ model: MODEL, input: texts }) });
  if (!res.ok) throw new Error(`embed ${res.status}: ${await res.text()}`);
  return (await res.json()).embeddings;
}

// Full-text: the clause's words joined with OR (AND would almost never match a whole sentence),
// stemmed with the piece's own language, ranked by ts_rank_cd.
const fts = (q, jur) => sql.query(
  `SELECT piece_id, slot_id FROM law_pieces,
     LATERAL (SELECT replace(plainto_tsquery(CASE lang WHEN 'ru' THEN 'russian' WHEN 'de' THEN 'german'
       ELSE 'english' END::regconfig, $1)::text, '&', '|')::tsquery AS q) x
   WHERE jurisdiction = $2 AND tsv @@ q ORDER BY ts_rank_cd(tsv, q) DESC LIMIT ${POOL}`, [q, jur]);

// Vector: nearest pieces by cosine distance. iterative_scan keeps the HNSW index from returning
// fewer rows than asked when the jurisdiction filter throws most neighbours away.
const vec = async (v, jur) => (await sql.transaction([
  sql.query("SET LOCAL hnsw.iterative_scan = relaxed_order"),
  sql.query(`SELECT piece_id, slot_id FROM law_pieces WHERE jurisdiction = $2 AND embedding IS NOT NULL
             ORDER BY embedding <=> $1::vector LIMIT ${POOL}`, [JSON.stringify(v), jur]),
]))[1];

// Hybrid: Reciprocal Rank Fusion, score = Σ 1 / (60 + rank) over both lists.
function rrf(...lists) {
  const score = new Map(), row = new Map();
  for (const list of lists) list.forEach((r, i) => {
    score.set(r.piece_id, (score.get(r.piece_id) ?? 0) + 1 / (60 + i + 1));
    row.set(r.piece_id, r);
  });
  return [...score.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => row.get(id));
}

const norm = (id) => id.replace(/@[a-z]{2}/, "");
const rankOf = (rows, expect) => {
  const i = rows.slice(0, K).findIndex((r) => expect.some((e) => norm(r.slot_id) === e || norm(r.slot_id).startsWith(e + ":")));
  return i < 0 ? null : i + 1;
};

const vectors = await embed(cases.map((c) => c.query));
const results = [];
for (const [i, c] of cases.entries()) {
  const f = await fts(c.query, c.jurisdiction);
  const v = await vec(vectors[i], c.jurisdiction);
  const h = rrf(f, v);
  results.push({
    id: c.id, jurisdiction: c.jurisdiction, expect: c.expect,
    fts: rankOf(f, c.expect), vector: rankOf(v, c.expect), hybrid: rankOf(h, c.expect),
    top: { fts: f.slice(0, K).map((r) => r.slot_id), vector: v.slice(0, K).map((r) => r.slot_id), hybrid: h.slice(0, K).map((r) => r.slot_id) },
  });
}

const show = (r) => (r == null ? "  –" : `  ${r}`);
console.log(`\n${"case".padEnd(28)} jur    fts vec hyb   (rank of the right article in top ${K}, – = missed)`);
for (const r of results) console.log(`${r.id.padEnd(28)} ${r.jurisdiction.padEnd(6)}${show(r.fts)} ${show(r.vector)} ${show(r.hybrid)}`);
const summary = {};
for (const m of ["fts", "vector", "hybrid"]) {
  const hits = results.filter((r) => r[m] != null).length;
  const mrr = results.reduce((s, r) => s + (r[m] ? 1 / r[m] : 0), 0) / results.length;
  summary[m] = { recall: +(hits / results.length).toFixed(3), mrr: +mrr.toFixed(3), hits, total: results.length };
}
console.log(`\nrecall@${K}:  fts ${summary.fts.hits}/${results.length}  ·  vector ${summary.vector.hits}/${results.length}  ·  hybrid ${summary.hybrid.hits}/${results.length}`);
console.log(`MRR@${K}:     fts ${summary.fts.mrr}  ·  vector ${summary.vector.mrr}  ·  hybrid ${summary.hybrid.mrr}`);

mkdirSync("evals/results", { recursive: true });
writeFileSync("evals/results/retrieval-latest.json",
  JSON.stringify({ model: MODEL, k: K, ranAt: new Date().toISOString(), summary, results }, null, 2));
