import { normalizeModelSlug } from "@/lib/yandex-gpt/model-uri";

export const MIN_DOCUMENT_LENGTH = 10;
/** Внутренний лимит для отправки в LLM (без ошибки пользователю — текст мягко обрезается) */
export const LLM_INPUT_MAX_CHARS = 100_000;
export const MAX_FILE_SIZE = 5 * 1024 * 1024;
export const API_TIMEOUT = 55000;

/** Основная модель: slug или slug/latest (напр. yandexgpt-5.1/latest) */
export const YANDEX_CLOUD_MODEL = "yandexgpt-5.1/latest";

/** Fallback при 404, если модель недоступна в каталоге */
export const YANDEX_CLOUD_MODEL_FALLBACK = "yandexgpt";

export function resolveModel(envValue: string | undefined, fallback: string): string {
  return envValue ? normalizeModelSlug(envValue) : normalizeModelSlug(fallback);
}

export const ANALYZE_TEMPERATURE = 0.2;
export const ANALYZE_MAX_TOKENS = 2000;
export const REVISE_MAX_TOKENS = 8000;
export const AGENT_DELAY_MS = 300;
export const ESTIMATED_AGENT_TIME_SEC = 15;
