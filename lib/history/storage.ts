import type { ReviewRecord } from "@/types/agent";

export const HISTORY_STORAGE_KEY = "agentflow-history";
export const MAX_HISTORY_ITEMS = 20;
export const PREVIEW_LENGTH = 200;

export function createDocumentPreview(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= PREVIEW_LENGTH) return trimmed;
  return `${trimmed.slice(0, PREVIEW_LENGTH)}...`;
}

export function trimHistoryItems(items: ReviewRecord[]): ReviewRecord[] {
  return items.slice(0, MAX_HISTORY_ITEMS);
}
