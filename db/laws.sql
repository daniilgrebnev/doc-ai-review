-- Legal norms for the jurisdiction RAG (Neon Postgres, project contract-check).
-- Filled by scripts/laws/load-neon.mjs from data/laws/slots/**.json. Re-runnable.

-- A slot is one legal unit: article / § / section, point, subpoint ... (tree via parent_slot_id).
CREATE TABLE IF NOT EXISTS law_slots (
  slot_id        text        PRIMARY KEY,                 -- readable key, e.g. ru:gk:333:1
  uid            uuid        NOT NULL UNIQUE,             -- uuid5(slot_id), stable across reloads
  parent_slot_id text        REFERENCES law_slots (slot_id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  kind           text        NOT NULL,                    -- article | point | subpoint | paragraph | number | letter | ...
  number         text,
  title          text,
  article_title  text        NOT NULL,                    -- "ГК РФ, ст. 333. Уменьшение неустойки"
  summary        text,                                    -- one sentence, filled later by a cheap model
  jurisdiction   text        NOT NULL CHECK (jurisdiction IN ('RU', 'DE', 'EU', 'US-NY')),
  lang           text        NOT NULL CHECK (lang IN ('ru', 'de', 'en')),
  law            text        NOT NULL,                    -- ГК РФ | BGB | Directive 2011/7/EU | NY Uniform Commercial Code ...
  law_part       text,
  act            text,
  edition        text,
  path           text[]      NOT NULL DEFAULT '{}',       -- раздел → глава / Buch → Titel / Article → Part
  source_url     text,
  requirements   text[]      NOT NULL DEFAULT '{}',       -- R1..R7, filled later
  repealed       boolean     NOT NULL DEFAULT false,
  children       text[]      NOT NULL DEFAULT '{}',
  amendments     text[]      NOT NULL DEFAULT '{}',
  text           text        NOT NULL DEFAULT '',         -- the slot's own text (children not included)
  hash           text,                                    -- sha256 prefix of text, to reload only changed slots
  loaded_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS law_slots_parent_idx ON law_slots (parent_slot_id);
CREATE INDEX IF NOT EXISTS law_slots_jur_law_idx ON law_slots (jurisdiction, law);
CREATE INDEX IF NOT EXISTS law_slots_requirements_idx ON law_slots USING gin (requirements);

-- A piece is up to ~800 characters of a slot's text, cut on sentences; this is what search matches.
CREATE TABLE IF NOT EXISTS law_pieces (
  piece_id     text    PRIMARY KEY,                       -- ru:gk:333:1#1
  slot_id      text    NOT NULL REFERENCES law_slots (slot_id) ON DELETE CASCADE,
  ord          integer NOT NULL CHECK (ord > 0),
  text         text    NOT NULL,
  embed_text   text    NOT NULL,                          -- article title + text, what gets embedded
  jurisdiction text    NOT NULL,
  lang         text    NOT NULL,
  tsv          tsvector GENERATED ALWAYS AS (
                 to_tsvector(
                   CASE lang WHEN 'ru' THEN 'russian'::regconfig
                             WHEN 'de' THEN 'german'::regconfig
                             ELSE 'english'::regconfig END,
                   embed_text)
               ) STORED,
  UNIQUE (slot_id, ord)
);
CREATE INDEX IF NOT EXISTS law_pieces_slot_idx ON law_pieces (slot_id);
CREATE INDEX IF NOT EXISTS law_pieces_jur_idx ON law_pieces (jurisdiction, lang);
CREATE INDEX IF NOT EXISTS law_pieces_tsv_idx ON law_pieces USING gin (tsv);

-- Vectors come once the embedding model is chosen (dimension depends on it), e.g.:
--   CREATE EXTENSION IF NOT EXISTS vector;
--   ALTER TABLE law_pieces ADD COLUMN embedding vector(1024), ADD COLUMN embedding_model text;
--   CREATE INDEX law_pieces_embedding_idx ON law_pieces USING hnsw (embedding vector_cosine_ops);
