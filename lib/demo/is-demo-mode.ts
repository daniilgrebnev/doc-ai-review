import { getProvidersForRequest } from "@/lib/llm/providers";

/** Демо-режим: для этого пользователя нет ни одного доступного провайдера (нет ключей или регион) */
export function isDemoMode(headers: Headers = new Headers()): boolean {
  return getProvidersForRequest(headers).demo;
}
