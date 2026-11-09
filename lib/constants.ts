export const MIN_DOCUMENT_LENGTH = 10;
/** Внутренний лимит для отправки в LLM (без ошибки пользователю — текст мягко обрезается) */
export const LLM_INPUT_MAX_CHARS = 100_000;
export const MAX_FILE_SIZE = 5 * 1024 * 1024;
/** Таймаут одного запроса к Claude (мс); maxDuration роутов в vercel.json — 300 с */
export const API_TIMEOUT = 120_000;

/** Модель Claude по умолчанию (переопределяется ANTHROPIC_MODEL) */
export const CLAUDE_DEFAULT_MODEL = "claude-opus-5-5";

/** Глубина рассуждений по умолчанию (переопределяется ANTHROPIC_EFFORT) */
export const CLAUDE_DEFAULT_EFFORT = "medium" as const;

/** Лимиты вывода с запасом: у Claude Opus 5.5 рассуждения всегда включены и тоже тратят выходные токены */
export const ANALYZE_MAX_TOKENS = 8000;
export const REVISE_MAX_TOKENS = 32000;
export const AGENT_DELAY_MS = 300;
export const ESTIMATED_AGENT_TIME_SEC = 15;
