/**
 * Лимит бесплатных запусков модели на одного клиента (демо на GitHub).
 * Клиент = sha256(User-Agent + IP): одного User-Agent мало, у всех пользователей
 * одной версии Chrome он одинаковый. Считаются только запуски, где модель реально
 * вызывалась (attempts IS NOT NULL), — проверки и генерации вместе.
 * RUN_LIMIT_PER_CLIENT=0 отключает лимит. Без DATABASE_URL лимита нет.
 */
import { createHash } from "node:crypto";
import { neon } from "@neondatabase/serverless";

const DEFAULT_LIMIT = 10;

export function getRunLimit(): number {
  const raw = process.env.RUN_LIMIT_PER_CLIENT;
  const n = raw === undefined || raw.trim() === "" ? DEFAULT_LIMIT : Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : DEFAULT_LIMIT;
}

function clientIp(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return fwd || headers.get("x-real-ip")?.trim() || "";
}

export function getClientHash(headers: Headers): string {
  const ua = headers.get("user-agent") ?? "";
  return createHash("sha256").update(`${ua}\n${clientIp(headers)}`).digest("hex");
}

export interface Quota {
  limit: number;
  used: number;
  remaining: number;
  exceeded: boolean;
}

/** null — лимит выключен (нет БД или RUN_LIMIT_PER_CLIENT=0). При ошибке БД не блокируем. */
export async function getQuota(headers: Headers): Promise<Quota | null> {
  const url = process.env.DATABASE_URL;
  const limit = getRunLimit();
  if (!url || limit === 0) return null;
  try {
    const sql = neon(url, { fetchOptions: { cache: "no-store" } });
    const rows = await sql`SELECT count(*) AS used FROM check_runs WHERE client_hash = ${getClientHash(headers)} AND attempts IS NOT NULL`;
    const used = Number(rows[0]?.used ?? 0);
    return { limit, used, remaining: Math.max(limit - used, 0), exceeded: used >= limit };
  } catch (error) {
    console.error("[quota]", error);
    return null;
  }
}

export const LIMIT_MESSAGE = "The free demo limit is used up.";
