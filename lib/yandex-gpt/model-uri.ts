/** Допустимые slug моделей Yandex Foundation Models */
export const YANDEX_MODELS = {
  pro: "yandexgpt",
  lite: "yandexgpt-lite",
  pro32k: "yandexgpt-32k",
  pro51: "yandexgpt-5.1",
} as const;

/** Устаревшие/ошибочные алиасы → корректный slug */
const MODEL_ALIASES: Record<string, string> = {
  "yandexgpt-pro": YANDEX_MODELS.pro,
  pro: YANDEX_MODELS.pro,
};

export function normalizeModelSlug(model: string): string {
  let slug = model.trim();

  // Полный URI: gpt://folder/yandexgpt-5.1/latest
  const uriMatch = slug.match(/^gpt:\/\/[^/]+\/([^/]+?)(?:\/latest)?$/);
  if (uriMatch) {
    slug = uriMatch[1];
  }

  slug = slug.replace(/\/latest$/, "");

  return MODEL_ALIASES[slug] ?? slug;
}

export function buildModelUri(folderId: string, model: string): string {
  const slug = normalizeModelSlug(model);
  return `gpt://${folderId}/${slug}/latest`;
}

export function formatModelLabel(model: string): string {
  const slug = normalizeModelSlug(model);
  const labels: Record<string, string> = {
    yandexgpt: "YandexGPT Pro",
    "yandexgpt-lite": "YandexGPT Lite",
    "yandexgpt-32k": "YandexGPT 32K",
    "yandexgpt-5.1": "YandexGPT 5.1",
    "yandexgpt/rc": "YandexGPT RC",
  };
  return labels[slug] ?? slug;
}
