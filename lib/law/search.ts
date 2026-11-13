/**
 * Vector search over the law base (Neon: law_pieces with bge-m3 embeddings, see db/laws.sql).
 * Server only. Vector search beat full-text and hybrid on the retrieval eval
 * (scripts/laws/eval-retrieval.mjs: recall@5 15/21 vs 13/21 hybrid, 7/21 full-text), so it is
 * vector only here.
 */
import { neon } from "@neondatabase/serverless";
import type { LawHit } from "@/lib/check/law";

const EMBED_TIMEOUT_MS = 20_000;

export function isLawSearchConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL && process.env.EMBED_URL) && process.env.LAW_CHECK !== "off";
}

/** bge-m3 vectors from the Ollama-compatible endpoint (EMBED_URL) */
export async function embed(texts: string[]): Promise<number[][]> {
  const res = await fetch(process.env.EMBED_URL!, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.EMBED_API_KEY ? { Authorization: `Bearer ${process.env.EMBED_API_KEY}` } : {}),
    },
    body: JSON.stringify({ model: process.env.EMBED_MODEL || "bge-m3", input: texts }),
    signal: AbortSignal.timeout(EMBED_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`embed ${res.status}`);
  const { embeddings } = (await res.json()) as { embeddings?: number[][] };
  if (!embeddings || embeddings.length !== texts.length) throw new Error("embed: wrong number of vectors");
  return embeddings;
}

/**
 * Top `k` pieces for each query, in one round trip. `jurisdictions` empty = search everywhere.
 * iterative_scan keeps the HNSW index from returning fewer rows when the filter drops neighbours.
 */
export async function searchLaw(queries: string[], jurisdictions: string[], k = 5): Promise<LawHit[][]> {
  if (queries.length === 0) return [];
  const vectors = await embed(queries);
  const sql = neon(process.env.DATABASE_URL!, { fetchOptions: { cache: "no-store" } });
  const [, rows] = await sql.transaction([
    sql.query("SET LOCAL hnsw.iterative_scan = relaxed_order"),
    sql.query(
      `SELECT q.i::int AS i, h.*
         FROM unnest($1::text[]) WITH ORDINALITY AS q(v, i),
         LATERAL (
           SELECT p.slot_id, p.piece_id, p.text, p.jurisdiction, s.article_title,
                  (p.embedding <=> q.v::vector) AS distance
             FROM law_pieces p JOIN law_slots s ON s.slot_id = p.slot_id
            WHERE p.embedding IS NOT NULL AND NOT s.repealed
              AND (cardinality($2::text[]) = 0 OR p.jurisdiction = ANY($2::text[]))
            ORDER BY p.embedding <=> q.v::vector
            LIMIT ${Math.max(1, Math.min(20, k))}
         ) h
        ORDER BY q.i, h.distance`,
      [vectors.map((v) => JSON.stringify(v)), jurisdictions]
    ),
  ]);
  const out: LawHit[][] = queries.map(() => []);
  for (const r of rows as Array<Record<string, unknown>>) {
    out[Number(r.i) - 1].push({
      slotId: String(r.slot_id),
      pieceId: String(r.piece_id),
      articleTitle: String(r.article_title),
      text: String(r.text),
      jurisdiction: String(r.jurisdiction),
      distance: Number(r.distance),
    });
  }
  return out;
}
