/**
 * Лог запусков проверки договора в Neon Postgres (таблица check_runs).
 * Если DATABASE_URL не задан — запись молча пропускается.
 * Ошибка записи никогда не ломает ответ пользователю.
 */
import { createHash } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { computeCostUsd } from "@/lib/db/pricing";

export type RunStatus = "ok" | "failed" | "input_error" | "blocked" | "no_model" | "limited";

export interface RunAttempt {
  provider: string;
  ok: boolean;
  ms: number;
  error?: string;
}

export interface CheckRunLog {
  route: string;
  status: RunStatus;
  error?: string;
  text: string;
  clauses?: number;
  providerRequested?: string;
  provider?: string;
  model?: string;
  fallbackFrom?: string;
  attempts?: RunAttempt[];
  findingsCount?: number;
  findingsExact?: number;
  inputTokens?: number;
  outputTokens?: number;
  durationMs: number;
  modelMs?: number;
  country?: string | null;
  /** sha256(User-Agent + IP), для лимита запусков */
  clientHash?: string;
}

/** Первая непустая строка документа — обычно заголовок договора */
export function documentTitle(text: string): string | null {
  const line = text.split("\n").map((l) => l.trim()).find(Boolean);
  return line ? line.slice(0, 200) : null;
}

export async function logCheckRun(run: CheckRunLog): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) return;
  try {
    const sql = neon(url, { fetchOptions: { cache: "no-store" } });
    const cost =
      run.model && run.inputTokens != null && run.outputTokens != null
        ? computeCostUsd(run.model, run.inputTokens, run.outputTokens)
        : null;
    await sql`
      INSERT INTO check_runs (
        route, status, error, doc_sha256, doc_chars, doc_clauses, doc_title,
        provider_requested, provider, model, fallback_from, attempts,
        findings_count, findings_exact, input_tokens, output_tokens, cost_usd,
        duration_ms, model_ms, country, client_hash
      ) VALUES (
        ${run.route}, ${run.status}, ${run.error ?? null},
        ${run.text ? createHash("sha256").update(run.text).digest("hex") : null},
        ${run.text.length}, ${run.clauses ?? null}, ${documentTitle(run.text)},
        ${run.providerRequested ?? null}, ${run.provider ?? null}, ${run.model ?? null},
        ${run.fallbackFrom ?? null}, ${run.attempts ? JSON.stringify(run.attempts) : null},
        ${run.findingsCount ?? null}, ${run.findingsExact ?? null},
        ${run.inputTokens ?? null}, ${run.outputTokens ?? null}, ${cost},
        ${run.durationMs}, ${run.modelMs ?? null}, ${run.country ?? null}, ${run.clientHash ?? null}
      )`;
  } catch (error) {
    console.error("[db] failed to log check run", error);
  }
}
