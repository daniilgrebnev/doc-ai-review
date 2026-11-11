export const PROVIDER_IDS = ["claude", "yandex", "deepseek"] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];

export function isProviderId(value: unknown): value is ProviderId {
  return typeof value === "string" && (PROVIDER_IDS as readonly string[]).includes(value);
}

export interface ProviderInfo {
  id: ProviderId;
  label: string;
  /** Модель, которая будет использована */
  model: string;
  /** Ключи провайдера заданы на сервере */
  configured: boolean;
  /** Провайдер недоступен из-за региона пользователя */
  geoBlocked: boolean;
  available: boolean;
}

export interface ProvidersResponse {
  providers: ProviderInfo[];
  /** Провайдер по умолчанию для этого пользователя, null — демо-режим */
  defaultProvider: ProviderId | null;
  country: string | null;
  demo: boolean;
}
