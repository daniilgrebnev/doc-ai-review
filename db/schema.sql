-- Лог запусков проверки договора (Neon Postgres, проект contract-check)
CREATE TABLE IF NOT EXISTS check_runs (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at    timestamptz NOT NULL DEFAULT now(),
  route         text        NOT NULL,
  status        text        NOT NULL CHECK (status IN ('ok','failed','input_error','blocked','no_model')),
  error         text,
  doc_sha256    text,          -- хеш текста, сам текст не храним
  doc_chars     integer,
  doc_clauses   integer,
  doc_title     text,          -- первая строка документа
  provider_requested text,
  provider      text,
  model         text,
  fallback_from text,
  attempts      jsonb,         -- [{provider, ok, ms, error?}]
  findings_count integer,
  findings_exact integer,
  input_tokens  integer,
  output_tokens integer,
  cost_usd      numeric(12,6), -- null, если цена модели неизвестна (YandexGPT)
  duration_ms   integer NOT NULL,
  model_ms      integer,
  country       text
);

-- Лимит бесплатных запусков на клиента (sha256 от User-Agent + IP)
ALTER TABLE check_runs ADD COLUMN IF NOT EXISTS client_hash text;
ALTER TABLE check_runs DROP CONSTRAINT IF EXISTS check_runs_status_check;
ALTER TABLE check_runs ADD CONSTRAINT check_runs_status_check
  CHECK (status IN ('ok','failed','input_error','blocked','no_model','limited'));
CREATE INDEX IF NOT EXISTS check_runs_client_hash_idx ON check_runs (client_hash) WHERE attempts IS NOT NULL;
