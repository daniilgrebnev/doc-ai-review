import { complete as completeClaude } from "@/lib/claude/client";
import type { CompleteResult, LlmMessage } from "@/lib/claude/types";
import { LlmError } from "@/lib/claude/types";
import {
  ANALYZE_MAX_TOKENS,
  ANALYZE_TEMPERATURE,
  REVISE_MAX_TOKENS,
  YANDEX_ANALYZE_MAX_TOKENS,
  YANDEX_REVISE_MAX_TOKENS,
} from "@/lib/constants";
import { getProviderModel } from "@/lib/llm/providers";
import type { ProviderId } from "@/lib/llm/types";
import { complete as completeYandex } from "@/lib/yandex-gpt/client";
import { YandexGptError } from "@/lib/yandex-gpt/types";

export type CompletionPurpose = "analyze" | "revise";

export interface LlmCompleteOptions {
  purpose: CompletionPurpose;
  /** Для YandexGPT; Claude температуру не принимает */
  temperature?: number;
}

/** Единая точка вызова LLM: Claude или YandexGPT */
export async function llmComplete(
  provider: ProviderId,
  messages: LlmMessage[],
  options: LlmCompleteOptions
): Promise<CompleteResult> {
  if (provider === "claude") {
    return completeClaude(messages, {
      maxTokens: options.purpose === "revise" ? REVISE_MAX_TOKENS : ANALYZE_MAX_TOKENS,
    });
  }

  try {
    const result = await completeYandex(messages, {
      model: getProviderModel("yandex"),
      temperature: options.temperature ?? ANALYZE_TEMPERATURE,
      maxTokens:
        options.purpose === "revise" ? YANDEX_REVISE_MAX_TOKENS : YANDEX_ANALYZE_MAX_TOKENS,
      fallbackOn404: true,
    });
    return {
      text: result.text,
      model: result.model,
      usage: {
        inputTokens: Number(result.usage.inputTextTokens) || 0,
        outputTokens: Number(result.usage.completionTokens) || 0,
      },
      refused: false,
    };
  } catch (error) {
    if (error instanceof YandexGptError) {
      throw new LlmError(error.message, error.statusCode);
    }
    throw error;
  }
}
