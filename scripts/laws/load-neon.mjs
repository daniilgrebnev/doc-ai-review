// Load data/laws/slots/**/*.json into Neon (tables from db/laws.sql).
// Upserts slots by slot_id and replaces their pieces. Slots whose hash did not change
// are skipped, so a re-run after re-slicing only touches what changed.
//
// Usage: node --env-file=.env.local scripts/laws/load-neon.mjs [path/to/slots.json ...]
import { neon } from "@neondatabase/serverless";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const sql = neon(process.env.DATABASE_URL);
const BATCH = 400;

function files(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return files(p);
    return p.endsWith(".json") && !p.endsWith(".sample.json") ? [p] : [];
  });
}

const targets = process.argv.slice(2).length ? process.argv.slice(2) : files("data/laws/slots");
for (const file of targets) {
  const slots = JSON.parse(readFileSync(file, "utf8"));
  const known = new Map(
    (await sql.query("SELECT slot_id, hash FROM law_slots WHERE slot_id = ANY($1)", [slots.map((s) => s.slotId)]))
      .map((r) => [r.slot_id, r.hash]),
  );
  const changed = slots.filter((s) => !known.has(s.slotId) || known.get(s.slotId) !== s.hash);
  let pieces = 0;
  for (let i = 0; i < changed.length; i += BATCH) {
    const batch = changed.slice(i, i + BATCH);
    const rows = batch.map((s) => ({
      slot_id: s.slotId, uid: s.uid, parent_slot_id: s.parentSlotId, kind: s.kind, number: s.number,
      title: s.title, article_title: s.articleTitle, summary: s.summary, jurisdiction: s.jurisdiction,
      lang: s.lang, law: s.law, law_part: s.lawPart, act: s.act, edition: s.edition, path: s.path ?? [],
      source_url: s.sourceUrl, requirements: s.requirements ?? [], repealed: s.repealed,
      children: s.children ?? [], amendments: s.amendments ?? [], text: s.text ?? "", hash: s.hash,
    }));
    const prows = batch.flatMap((s) => s.pieces.map((p) => ({
      piece_id: p.pieceId, slot_id: s.slotId, ord: p.order, text: p.text, embed_text: p.embedText,
      jurisdiction: s.jurisdiction, lang: s.lang,
    })));
    pieces += prows.length;
    await sql.transaction([
      sql.query(
        `INSERT INTO law_slots (slot_id, uid, parent_slot_id, kind, number, title, article_title, summary,
           jurisdiction, lang, law, law_part, act, edition, path, source_url, requirements, repealed,
           children, amendments, text, hash, loaded_at)
         SELECT slot_id, uid, parent_slot_id, kind, number, title, article_title, summary, jurisdiction, lang,
           law, law_part, act, edition, path, source_url, requirements, repealed, children, amendments, text,
           hash, now()
         FROM json_populate_recordset(NULL::law_slots, $1::json)
         ON CONFLICT (slot_id) DO UPDATE SET uid = EXCLUDED.uid, parent_slot_id = EXCLUDED.parent_slot_id,
           kind = EXCLUDED.kind, number = EXCLUDED.number, title = EXCLUDED.title,
           article_title = EXCLUDED.article_title, jurisdiction = EXCLUDED.jurisdiction, lang = EXCLUDED.lang,
           law = EXCLUDED.law, law_part = EXCLUDED.law_part, act = EXCLUDED.act, edition = EXCLUDED.edition,
           path = EXCLUDED.path, source_url = EXCLUDED.source_url, repealed = EXCLUDED.repealed,
           children = EXCLUDED.children, amendments = EXCLUDED.amendments, text = EXCLUDED.text,
           hash = EXCLUDED.hash, loaded_at = now(),
           summary = CASE WHEN law_slots.hash IS DISTINCT FROM EXCLUDED.hash THEN NULL ELSE law_slots.summary END`,
        [JSON.stringify(rows)],
      ),
      sql.query("DELETE FROM law_pieces WHERE slot_id = ANY($1)", [batch.map((s) => s.slotId)]),
      sql.query(
        `INSERT INTO law_pieces (piece_id, slot_id, ord, text, embed_text, jurisdiction, lang)
         SELECT piece_id, slot_id, ord, text, embed_text, jurisdiction, lang
         FROM json_to_recordset($1::json) AS x(piece_id text, slot_id text, ord int, text text,
           embed_text text, jurisdiction text, lang text)`,
        [JSON.stringify(prows)],
      ),
    ]);
  }
  console.log(`${file}: ${slots.length} slots, ${changed.length} written, ${pieces} pieces`);
}
