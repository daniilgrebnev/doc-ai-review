import { getDefaultModel as getClaudeModel } from "@/lib/claude/client";
import { YANDEX_CLOUD_MODEL, resolveModel } from "@/lib/constants";
import { getRequestCountry, isClaudeGeoBlocked } from "@/lib/llm/geo";
import type { ProviderId, ProviderInfo, ProvidersResponse } from "@/lib/llm/types";

export function isProviderConfigured(id: ProviderId): boolean {
  if (id === "claude") return Boolean(process.env.ANTHROPIC_API_KEY);
  return Boolean(process.env.YC_API_KEY && process.env.YC_FOLDER_ID);
}

export function getProviderModel(id: ProviderId): string {
  if (id === "claude") return getClaudeModel();
  return resolveModel(process.env.YANDEX_CLOUD_MODEL, YANDEX_CLOUD_MODEL);
}

export function getProvidersForRequest(headers: Headers): ProvidersResponse {
  const country = getRequestCountry(headers);
  const claudeBlocked = isClaudeGeoBlocked(country);

  const providers: ProviderInfo[] = [
    {
      id: "yandex",
      label: "YandexGPT",
      model: getProviderModel("yandex"),
      configured: isProviderConfigured("yandex"),
      geoBlocked: false,
      available: false,
    },
    {
      id: "claude",
      label: "Claude",
      model: getProviderModel("claude"),
      configured: isProviderConfigured("claude"),
      geoBlocked: claudeBlocked,
      available: false,
    },
  ];
  for (const p of providers) p.available = p.configured && !p.geoBlocked;

  // По умолчанию Claude, если доступен, иначе YandexGPT
  const preferred: ProviderId[] = ["claude", "yandex"];
  const defaultProvider =
    preferred.find((id) => providers.find((p) => p.id === id)?.available) ?? null;

  return { providers, defaultProvider, country, demo: defaultProvider === null };
}

export type ProviderResolution =
  | { kind: "provider"; provider: ProviderId }
  | { kind: "demo" }
  | { kind: "error"; status: number; message: string };

/** Выбирает провайдера для запроса с учётом ключей и региона пользователя */
export function resolveProvider(requested: unknown, headers: Headers): ProviderResolution {
  const { providers, defaultProvider } = getProvidersForRequest(headers);

  if (requested === undefined || requested === null || requested === "") {
    return defaultProvider ? { kind: "provider", provider: defaultProvider } : { kind: "demo" };
  }

  const info = providers.find((p) => p.id === requested);
  if (!info) {
    return { kind: "error", status: 400, message: "Неизвестная модель. Допустимые: claude, yandex" };
  }
  if (info.geoBlocked) {
    return { kind: "error", status: 403, message: "Claude недоступен в вашем регионе. Выберите YandexGPT." };
  }
  if (!info.configured) {
    return defaultProvider
      ? { kind: "error", status: 400, message: `${info.label} не настроен на сервере` }
      : { kind: "demo" };
  }
  return { kind: "provider", provider: info.id };
}
