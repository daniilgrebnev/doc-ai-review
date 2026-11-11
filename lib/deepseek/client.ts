import { API_TIMEOUT } from "@/lib/constants";
import type { CompleteResult, LlmMessage } from "@/lib/claude/types";
import { LlmError } from "@/lib/claude/types";

/** DeepSeek API совместим с OpenAI Chat Completions */
const DEEPSEEK_ENDPOINT = "https://api.deepseek.com/chat/completions";
export const DEEPSEEK_DEFAULT_MODEL = "deepseek-chat";

export function getDeepSeekModel(): string {
  return process.env.DEEPSEEK_MODEL?.trim() || DEEPSEEK_DEFAULT_MODEL;
}

interface DeepSeekResponse {
  model: string;
  choices: Array<{ message: { content: string | null }; finish_reason: string }>;
  usage?: { prompt_tokens: number; completion_tokens: number };
}

export async function complete(
  messages: LlmMessage[],
  options: { maxTokens: number; temperature?: number }
): Promise<CompleteResult> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new LlmError("Не настроена переменная окружения DEEPSEEK_API_KEY", 500);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

  try {
    const response = await fetch(DEEPSEEK_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: getDeepSeekModel(),
        messages: messages.map((m) => ({ role: m.role, content: m.text })),
        max_tokens: options.maxTokens,
        temperature: options.temperature,
        stream: false,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new LlmError(`DeepSeek API error: ${response.status} — ${errorText}`, response.status);
    }

    const data = (await response.json()) as DeepSeekResponse;
    const text = data.choices[0]?.message?.content?.trim() ?? "";
    if (!text) throw new LlmError("DeepSeek вернул пустой ответ", 502);

    return {
      text,
      model: data.model || getDeepSeekModel(),
      usage: {
        inputTokens: data.usage?.prompt_tokens ?? 0,
        outputTokens: data.usage?.completion_tokens ?? 0,
      },
      refused: false,
    };
  } catch (error) {
    if (error instanceof LlmError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new LlmError("Превышено время ожидания ответа DeepSeek", 504);
    }
    throw new LlmError(error instanceof Error ? error.message : "Неизвестная ошибка DeepSeek");
  } finally {
    clearTimeout(timeoutId);
  }
}
