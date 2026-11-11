import { normalizeModelSlug } from "@/lib/yandex-gpt/model-uri";

export const MIN_DOCUMENT_LENGTH = 10;
/** Внутренний лимит для отправки в LLM (без ошибки пользователю — текст мягко обрезается) */
export const LLM_INPUT_MAX_CHARS = 100_000;
export const MAX_FILE_SIZE = 5 * 1024 * 1024;
/** Таймаут одного запроса к Claude (мс); maxDuration роутов в vercel.json — 300 с */
export const API_TIMEOUT = 120_000;

/** Модель Claude по умолчанию (переопределяется ANTHROPIC_MODEL) */
export const CLAUDE_DEFAULT_MODEL = "claude-haiku-5-5";

/** Глубина рассуждений по умолчанию (переопределяется ANTHROPIC_EFFORT) */
export const CLAUDE_DEFAULT_EFFORT = "medium" as const;

/** Лимиты вывода с запасом: у современных моделей Claude рассуждения включены по умолчанию и тоже тратят выходные токены */
export const ANALYZE_MAX_TOKENS = 8000;
export const REVISE_MAX_TOKENS = 32000;
export const AGENT_DELAY_MS = 300;
export const ESTIMATED_AGENT_TIME_SEC = 15;

/** YandexGPT: модель (slug или slug/latest) и fallback при 404; переопределяется YANDEX_CLOUD_MODEL */
export const YANDEX_CLOUD_MODEL = "yandexgpt-5.1/latest";
export const YANDEX_CLOUD_MODEL_FALLBACK = "yandexgpt";
export const ANALYZE_TEMPERATURE = 0.2;
/** У YandexGPT рассуждений нет, лимиты вывода меньше */
export const YANDEX_ANALYZE_MAX_TOKENS = 2000;
export const YANDEX_REVISE_MAX_TOKENS = 8000;

export function resolveModel(envValue: string | undefined, fallback: string): string {
  return normalizeModelSlug(envValue || fallback);
}
