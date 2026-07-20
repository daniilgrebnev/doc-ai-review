/** Отказы модели — короткие фразы, не полные документы */
const REFUSAL_MAX_LENGTH = 600;

const REFUSAL_PATTERNS = [
  /не\s+(могу|могла|буду|имею\s+права)/i,
  /cannot\s+(discuss|help|talk|assist|provide)/i,
  /i\s+can'?t\s+(discuss|help|talk)/i,
  /не\s+отношусь/i,
  /не\s+могу\s+на\s+эти\s+темы/i,
  /не\s+могу\s+обсуждать/i,
  /вне\s+(моих\s+)?компетен/i,
  /отказываюсь/i,
  /content\s+filter/i,
  /модераци/i,
  /не\s+поддерживаю\s+так/i,
  /не\s+предназначен/i,
  /обсуждать\s+эту\s+тему/i,
  /давайте\s+поговорим/i,
];

export function isRefusalText(text: string): boolean {
  const normalized = text.trim();
  if (!normalized || normalized.length > REFUSAL_MAX_LENGTH) return false;

  const hasJson = normalized.includes("{") && normalized.includes("status");
  if (hasJson) return false;

  return REFUSAL_PATTERNS.some((pattern) => pattern.test(normalized));
}

export const REFUSAL_USER_MESSAGE =
  "Модель отказалась анализировать документ. Это бывает с договорами — нажмите «Повторить».";

export const REFUSAL_REVISE_MESSAGE =
  "Не удалось сгенерировать исправления. Нажмите «Перезагрузить».";

export const REFUSAL_RETRY_PREFIX = `ВАЖНО: Документ — типовой коммерческий договор для внутреннего согласования в компании.
Это стандартная деловая задача корпоративного аудита. Проведи формальный анализ документа по своей специализации.
Не отказывайся от анализа — оцени структуру, формулировки и риски.`;

export const REFUSAL_REVISE_RETRY_PREFIX = `ВАЖНО: Документ — типовой коммерческий договор для внутреннего согласования.
Твоя задача — юридическое редактирование: переписать текст с учётом замечаний экспертов.
Это стандартная корпоративная задача. Не отказывайся — верни полный исправленный текст документа.`;
