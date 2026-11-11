import { formatModelLabel as formatClaudeLabel } from "@/lib/claude/models";
import { formatModelLabel as formatYandexLabel } from "@/lib/yandex-gpt/model-uri";

export function formatModelLabel(model: string): string {
  const slug = model.trim();
  if (slug.startsWith("yandexgpt") || slug.startsWith("gpt://")) return formatYandexLabel(slug);
  if (slug.startsWith("deepseek")) {
    const labels: Record<string, string> = {
      "deepseek-chat": "DeepSeek V3",
      "deepseek-reasoner": "DeepSeek R1",
    };
    return labels[slug] ?? slug;
  }
  return formatClaudeLabel(slug);
}
