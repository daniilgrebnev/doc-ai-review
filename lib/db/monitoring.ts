/** Чтение лога запусков для вкладки Monitoring и /api/runs */
import { neon } from "@neondatabase/serverless";

export interface RunRow {
  id: number;
  createdAt: string;
  route: string;
  status: string;
  error: string | null;
  docTitle: string | null;
  docChars: number | null;
  docClauses: number | null;
  provider: string | null;
  model: string | null;
  fallbackFrom: string | null;
  findingsCount: number | null;
  findingsExact: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: number | null;
  durationMs: number;
  modelMs: number | null;
}

export interface Totals {
  runs: number;
  ok: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  p50Ms: number | null;
  p95Ms: number | null;
}

export interface ModelTotals {
  model: string;
  provider: string | null;
  runs: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  avgMs: number;
}

export interface MonitoringData {
  totals: Totals;
  last24h: Totals;
  byModel: ModelTotals[];
  byRoute: Array<{ route: string; runs: number; costUsd: number }>;
  runs: RunRow[];
}

const n = (v: unknown) => (v == null ? 0 : Number(v));
const nn = (v: unknown) => (v == null ? null : Number(v));

function toTotals(r: Record<string, unknown> | undefined): Totals {
  return {
    runs: n(r?.runs),
    ok: n(r?.ok),
    inputTokens: n(r?.input_tokens),
    outputTokens: n(r?.output_tokens),
    costUsd: n(r?.cost_usd),
    p50Ms: nn(r?.p50_ms),
    p95Ms: nn(r?.p95_ms),
  };
}

/** null, если DATABASE_URL не задан */
export async function getMonitoringData(limit = 100): Promise<MonitoringData | null> {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  const sql = neon(url);
  const safeLimit = Math.min(Math.max(Math.trunc(limit) || 100, 1), 500);

  const [totals, day, byModel, byRoute, runs] = await Promise.all([
    sql`SELECT count(*) runs, count(*) FILTER (WHERE status = 'ok') ok,
          sum(input_tokens) input_tokens, sum(output_tokens) output_tokens, sum(cost_usd) cost_usd,
          percentile_cont(0.5) WITHIN GROUP (ORDER BY model_ms) p50_ms,
          percentile_cont(0.95) WITHIN GROUP (ORDER BY model_ms) p95_ms
        FROM check_runs`,
    sql`SELECT count(*) runs, count(*) FILTER (WHERE status = 'ok') ok,
          sum(input_tokens) input_tokens, sum(output_tokens) output_tokens, sum(cost_usd) cost_usd,
          percentile_cont(0.5) WITHIN GROUP (ORDER BY model_ms) p50_ms,
          percentile_cont(0.95) WITHIN GROUP (ORDER BY model_ms) p95_ms
        FROM check_runs WHERE created_at > now() - interval '24 hours'`,
    sql`SELECT model, max(provider) provider, count(*) runs,
          coalesce(sum(input_tokens), 0) input_tokens, coalesce(sum(output_tokens), 0) output_tokens,
          coalesce(sum(cost_usd), 0) cost_usd, round(avg(model_ms)) avg_ms
        FROM check_runs WHERE model IS NOT NULL GROUP BY model ORDER BY count(*) DESC`,
    sql`SELECT route, count(*) runs, coalesce(sum(cost_usd), 0) cost_usd FROM check_runs GROUP BY route ORDER BY route`,
    sql`SELECT id, created_at, route, status, error, doc_title, doc_chars, doc_clauses, provider, model, fallback_from,
          findings_count, findings_exact, input_tokens, output_tokens, cost_usd, duration_ms, model_ms
        FROM check_runs ORDER BY id DESC LIMIT ${safeLimit}`,
  ]);

  return {
    totals: toTotals(totals[0]),
    last24h: toTotals(day[0]),
    byModel: byModel.map((r) => ({
      model: String(r.model),
      provider: (r.provider as string | null) ?? null,
      runs: n(r.runs),
      inputTokens: n(r.input_tokens),
      outputTokens: n(r.output_tokens),
      costUsd: n(r.cost_usd),
      avgMs: n(r.avg_ms),
    })),
    byRoute: byRoute.map((r) => ({ route: String(r.route), runs: n(r.runs), costUsd: n(r.cost_usd) })),
    runs: runs.map((r) => ({
      id: n(r.id),
      createdAt: new Date(r.created_at as string).toISOString(),
      route: String(r.route),
      status: String(r.status),
      error: (r.error as string | null) ?? null,
      docTitle: (r.doc_title as string | null) ?? null,
      docChars: nn(r.doc_chars),
      docClauses: nn(r.doc_clauses),
      provider: (r.provider as string | null) ?? null,
      model: (r.model as string | null) ?? null,
      fallbackFrom: (r.fallback_from as string | null) ?? null,
      findingsCount: nn(r.findings_count),
      findingsExact: nn(r.findings_exact),
      inputTokens: nn(r.input_tokens),
      outputTokens: nn(r.output_tokens),
      costUsd: nn(r.cost_usd),
      durationMs: n(r.duration_ms),
      modelMs: nn(r.model_ms),
    })),
  };
}
