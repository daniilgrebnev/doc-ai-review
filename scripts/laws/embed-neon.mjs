// Fill law_pieces.embedding with bge-m3 vectors (table/columns from db/laws.sql).
// Takes pieces whose embedding is NULL, sends embed_text to an Ollama-compatible /api/embed
// endpoint in batches and writes the vectors back by piece_id. Re-runnable: it only touches
// rows without a vector, so after load-neon.mjs re-inserts changed slots, only those get embedded.
//
// Usage: node --env-file=.env.local scripts/laws/embed-neon.mjs [--local] [--batch 32]
//   default endpoint: EMBED_URL + EMBED_API_KEY (the Hetzner server)
//   --local:          http://localhost:11434/api/embed (Ollama on this Mac, much faster for bulk)
// Both must serve the same model (EMBED_MODEL, default bge-m3), or vectors won't be comparable.
import { neon } from "@neondatabase/serverless";

const args = process.argv.slice(2);
const local = args.includes("--local");
const batchArg = args.indexOf("--batch");
const BATCH = batchArg >= 0 ? Number(args[batchArg + 1]) : 32;
const MODEL = process.env.EMBED_MODEL || "bge-m3";
const URL = local ? "http://localhost:11434/api/embed" : process.env.EMBED_URL;
const headers = { "Content-Type": "application/json" };
if (!local) headers.Authorization = `Bearer ${process.env.EMBED_API_KEY}`;

const sql = neon(process.env.DATABASE_URL);

async function embed(texts) {
  const res = await fetch(URL, { method: "POST", headers, body: JSON.stringify({ model: MODEL, input: texts }) });
  if (!res.ok) throw new Error(`embed ${res.status}: ${await res.text()}`);
  const { embeddings } = await res.json();
  if (embeddings?.length !== texts.length) throw new Error("embed: wrong number of vectors");
  return embeddings;
}

const [{ todo }] = await sql`SELECT count(*)::int AS todo FROM law_pieces WHERE embedding IS NULL`;
console.log(`${todo} pieces without a vector · model ${MODEL} · ${local ? "local Ollama" : URL}`);
const started = Date.now();
let done = 0;

while (true) {
  const rows = await sql`SELECT piece_id, embed_text FROM law_pieces
                         WHERE embedding IS NULL ORDER BY piece_id LIMIT ${BATCH}`;
  if (!rows.length) break;
  const vectors = await embed(rows.map((r) => r.embed_text));
  // One UPDATE per batch: piece_id ↔ vector pairs come in as JSON, pgvector parses '[...]' text.
  await sql.query(
    `UPDATE law_pieces p SET embedding = x.v::vector, embedding_model = $2
     FROM json_to_recordset($1::json) AS x(id text, v text) WHERE p.piece_id = x.id`,
    [JSON.stringify(rows.map((r, i) => ({ id: r.piece_id, v: JSON.stringify(vectors[i]) }))), MODEL],
  );
  done += rows.length;
  const rate = done / ((Date.now() - started) / 1000);
  process.stdout.write(`\r${done}/${todo} · ${rate.toFixed(1)}/s · ~${Math.round((todo - done) / rate / 60)} min left   `);
}
console.log(`\ndone in ${Math.round((Date.now() - started) / 1000)}s`);
