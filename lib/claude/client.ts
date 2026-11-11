import Anthropic from "@anthropic-ai/sdk";
import {
  ANALYZE_MAX_TOKENS,
  API_TIMEOUT,
  CLAUDE_DEFAULT_EFFORT,
  CLAUDE_DEFAULT_MODEL,
} from "@/lib/constants";
import { resolveEffort } from "@/lib/claude/models";
import type { CompleteResult, LlmMessage, LlmOptions } from "@/lib/claude/types";
import { LlmError } from "@/lib/claude/types";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new LlmError("Не настроена переменная окружения ANTHROPIC_API_KEY", 500);
  }
  client ??= new Anthropic({ timeout: API_TIMEOUT, maxRetries: 1 });
  return client;
}

export function getDefaultModel(): string {
  return process.env.ANTHROPIC_MODEL?.trim() || CLAUDE_DEFAULT_MODEL;
}

function supportsServerFallback(model: string): boolean {
  return !model.startsWith("claude-haiku");
}

export async function complete(
  messages: LlmMessage[],
  options: LlmOptions = {}
): Promise<CompleteResult> {
  const system = messages
    .filter((m) => m.role === "system")
    .map((m) => m.text)
    .join("\n\n");
  const userText = messages
    .filter((m) => m.role === "user")
    .map((m) => m.text)
    .join("\n\n");

  const model = options.model ?? getDefaultModel();

  try {
    // Стриминг + finalMessage: длинные ответы (revise) не упираются в HTTP-таймауты
    const stream = getClient().beta.messages.stream({
      model,
      max_tokens: options.maxTokens ?? ANALYZE_MAX_TOKENS,
      system: system || undefined,
      messages: [{ role: "user", content: userText }],
      output_config: {
        effort:
          options.effort ??
          resolveEffort(process.env.ANTHROPIC_EFFORT, CLAUDE_DEFAULT_EFFORT),
      },
      // При отказе классификатора безопасности запрос повторяется на рекомендованной модели.
      // У Haiku server-side fallback нет, поэтому параметр отправляется только для остальных моделей.
      ...(supportsServerFallback(model)
        ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }
        : {}),
    });

    const message = await stream.finalMessage();

    const text = message.content
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("")
      .trim();

    const refused = message.stop_reason === "refusal";

    if (!text && !refused) {
      throw new LlmError("Claude вернул пустой ответ", 502);
    }

    return {
      text,
      model: message.model,
      usage: {
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens,
      },
      refused,
    };
  } catch (error) {
    if (error instanceof LlmError) throw error;

    if (error instanceof Anthropic.APIConnectionTimeoutError) {
      throw new LlmError("Превышено время ожидания ответа Claude", 504);
    }
    if (error instanceof Anthropic.AuthenticationError) {
      throw new LlmError("Неверный ANTHROPIC_API_KEY", 500);
    }
    if (error instanceof Anthropic.RateLimitError) {
      throw new LlmError("Превышен лимит запросов к Claude, попробуйте позже", 429);
    }
    if (error instanceof Anthropic.APIError) {
      throw new LlmError(`Claude API error: ${error.status ?? ""} — ${error.message}`, error.status ?? 502);
    }

    throw new LlmError(
      error instanceof Error ? error.message : "Неизвестная ошибка Claude API"
    );
  }
}
