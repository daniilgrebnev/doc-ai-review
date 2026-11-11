/**
 * Гео-ограничение Claude: Anthropic не обслуживает пользователей из ряда стран (в т.ч. РФ),
 * поэтому для них Claude отключается и остаётся только YandexGPT.
 */

/** Заголовки, в которых хостинги/прокси передают страну клиента (ISO 3166-1 alpha-2) */
const COUNTRY_HEADERS = ["x-vercel-ip-country", "cf-ipcountry", "x-country-code"];

const DEFAULT_CLAUDE_BLOCKED_COUNTRIES = ["RU"];

export function getRequestCountry(headers: Headers): string | null {
  const override = process.env.GEO_COUNTRY_OVERRIDE?.trim();
  if (override) return override.toUpperCase();

  for (const name of COUNTRY_HEADERS) {
    const value = headers.get(name)?.trim();
    // XX / T1 — Cloudflare: неизвестно / Tor
    if (value && value !== "XX") return value.toUpperCase();
  }
  return null;
}

export function getClaudeBlockedCountries(): string[] {
  const raw = process.env.CLAUDE_BLOCKED_COUNTRIES;
  if (raw === undefined) return DEFAULT_CLAUDE_BLOCKED_COUNTRIES;
  return raw
    .split(",")
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean);
}

const DEFAULT_SITE_BLOCKED_COUNTRIES = ["UA"];

/** Страны, для которых весь сайт отдаёт 404 (SITE_BLOCKED_COUNTRIES, по умолчанию UA; пустая строка — выкл.) */
export function getSiteBlockedCountries(): string[] {
  const raw = process.env.SITE_BLOCKED_COUNTRIES;
  if (raw === undefined) return DEFAULT_SITE_BLOCKED_COUNTRIES;
  return raw
    .split(",")
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean);
}

/** Весь сайт закрыт, если страна в списке. Неизвестная страна — пропускаем. */
export function isSiteGeoBlocked(country: string | null): boolean {
  if (!country) return false;
  return getSiteBlockedCountries().includes(country);
}

/**
 * Claude заблокирован, если страна в списке. Если страну определить не удалось:
 * в продакшене блокируем (fail closed — лучше перестраховаться), локально разрешаем.
 */
export function isClaudeGeoBlocked(country: string | null): boolean {
  if (!country) return process.env.NODE_ENV === "production";
  if (country === "T1") return true;
  return getClaudeBlockedCountries().includes(country);
}
