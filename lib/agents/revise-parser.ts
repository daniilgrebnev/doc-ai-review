import { isRefusalText } from "@/lib/agents/refusal";

function stripMarkdownWrapper(text: string): string {
  const blockMatch = text.match(/```(?:\w+)?\s*([\s\S]*?)```/);
  if (blockMatch) {
    return blockMatch[1].trim();
  }
  return text.trim();
}

export function parseRevisedText(rawText: string): string | null {
  let text = stripMarkdownWrapper(rawText);

  const prefixes = [
    "Исправленный документ:",
    "Исправленный договор:",
    "Вот исправленный документ:",
  ];

  for (const prefix of prefixes) {
    if (text.startsWith(prefix)) {
      text = text.slice(prefix.length).trim();
    }
  }

  // Отказ модели — только короткий ответ, не полный договор
  if (text.length <= 600 && isRefusalText(text)) {
    return null;
  }

  return text;
}
