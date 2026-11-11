import {
  API_TIMEOUT,
  ANALYZE_TEMPERATURE,
  YANDEX_ANALYZE_MAX_TOKENS,
  YANDEX_CLOUD_MODEL,
  YANDEX_CLOUD_MODEL_FALLBACK,
  resolveModel,
} from "@/lib/constants";
import { buildModelUri, normalizeModelSlug } from "@/lib/yandex-gpt/model-uri";
import type {
  YGptCompletionResponse,
  YGptMessage,
  YGptOptions,
  YGptUsage,
} from "@/lib/yandex-gpt/types";
import { YandexGptError } from "@/lib/yandex-gpt/types";

const YGPT_ENDPOINT =
  "https://llm.api.cloud.yandex.net/foundationModels/v1/completion";

export interface CompleteResult {
  text: string;
  usage: YGptUsage;
  model: string;
}

function getDefaultModel(): string {
  return resolveModel(process.env.YANDEX_CLOUD_MODEL, YANDEX_CLOUD_MODEL);
}

async function requestCompletion(
  folderId: string,
  apiKey: string,
  model: string,
  messages: YGptMessage[],
  options: YGptOptions,
  signal: AbortSignal
): Promise<CompleteResult> {
  const response = await fetch(YGPT_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Api-Key ${apiKey}`,
    },
    body: JSON.stringify({
      modelUri: buildModelUri(folderId, model),
      completionOptions: {
        stream: false,
        temperature: options.temperature ?? ANALYZE_TEMPERATURE,
        maxTokens: options.maxTokens ?? YANDEX_ANALYZE_MAX_TOKENS,
      },
      messages,
    }),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new YandexGptError(
      `YandexGPT API error: ${response.status} — ${errorText}`,
      response.status
    );
  }

  const data = (await response.json()) as YGptCompletionResponse;
  const text = data.result.alternatives[0]?.message?.text;

  if (!text) {
    throw new YandexGptError("YandexGPT вернул пустой ответ");
  }

  return {
    text,
    usage: data.result.usage,
    model: normalizeModelSlug(model),
  };
}

export async function complete(
  messages: YGptMessage[],
  options: YGptOptions & { fallbackOn404?: boolean } = {}
): Promise<CompleteResult> {
  const apiKey = process.env.YC_API_KEY;
  const folderId = process.env.YC_FOLDER_ID;

  if (!apiKey || !folderId) {
    throw new YandexGptError(
      "Не настроены переменные окружения YC_API_KEY и YC_FOLDER_ID",
      500
    );
  }

  const primaryModel = options.model ?? getDefaultModel();
  const fallbackModel = YANDEX_CLOUD_MODEL_FALLBACK;
  const modelsToTry =
    options.fallbackOn404 &&
    normalizeModelSlug(primaryModel) !== normalizeModelSlug(fallbackModel)
      ? [primaryModel, fallbackModel]
      : [primaryModel];

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

  let lastError: YandexGptError | null = null;

  try {
    for (const model of modelsToTry) {
      try {
        return await requestCompletion(
          folderId,
          apiKey,
          model,
          messages,
          options,
          controller.signal
        );
      } catch (error) {
        if (
          error instanceof YandexGptError &&
          error.statusCode === 404 &&
          model !== modelsToTry[modelsToTry.length - 1]
        ) {
          if (process.env.NODE_ENV === "development") {
            console.warn(
              `[yandex-gpt] model ${normalizeModelSlug(model)} not found, fallback to ${fallbackModel}`
            );
          }
          lastError = error;
          continue;
        }
        throw error;
      }
    }

    throw lastError ?? new YandexGptError("Модель недоступна");
  } catch (error) {
    if (error instanceof YandexGptError) {
      throw error;
    }
    if (error instanceof Error && error.name === "AbortError") {
      throw new YandexGptError("Превышено время ожидания ответа YandexGPT", 504);
    }
    throw new YandexGptError(
      error instanceof Error ? error.message : "Неизвестная ошибка YandexGPT"
    );
  } finally {
    clearTimeout(timeoutId);
  }
}
