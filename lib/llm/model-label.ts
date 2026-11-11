import { formatModelLabel as formatClaudeLabel } from "@/lib/claude/models";
import { formatModelLabel as formatYandexLabel } from "@/lib/yandex-gpt/model-uri";

export function formatModelLabel(model: string): string {
  const slug = model.trim();
  if (slug.startsWith("yandexgpt") || slug.startsWith("gpt://")) return formatYandexLabel(slug);
  return formatClaudeLabel(slug);
}
