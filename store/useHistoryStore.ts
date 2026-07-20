"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  createDocumentPreview,
  HISTORY_STORAGE_KEY,
  trimHistoryItems,
} from "@/lib/history/storage";
import { computeVerdict } from "@/lib/pipeline/verdict";
import type { AgentResult, ReviewRecord } from "@/types/agent";

interface HistoryState {
  items: ReviewRecord[];
  _hasHydrated: boolean;
  setHasHydrated: (value: boolean) => void;
  addReview: (params: {
    documentText: string;
    agentResults: Record<string, AgentResult>;
    elapsedSeconds: number;
  }) => void;
  removeReview: (id: string) => void;
  clearAll: () => void;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function createSafeStorage() {
  return createJSONStorage(() => {
    if (typeof window === "undefined") {
      return {
        getItem: () => null,
        setItem: () => undefined,
        removeItem: () => undefined,
      };
    }
    return localStorage;
  });
}

export const useHistoryStore = create<HistoryState>()(
  persist(
    (set) => ({
      items: [],
      _hasHydrated: false,

      setHasHydrated: (value) => set({ _hasHydrated: value }),

      addReview: ({ documentText, agentResults, elapsedSeconds }) => {
        const results = Object.values(agentResults).filter(
          (r) => r.status !== "pending" && r.status !== "processing"
        );

        if (results.length === 0) return;

        const record: ReviewRecord = {
          id: generateId(),
          createdAt: new Date().toISOString(),
          documentPreview: createDocumentPreview(documentText),
          documentText,
          agentResults: results,
          verdict: computeVerdict(results),
          elapsedSeconds,
        };

        set((state) => ({
          items: trimHistoryItems([record, ...state.items]),
        }));
      },

      removeReview: (id) =>
        set((state) => ({
          items: state.items.filter((item) => item.id !== id),
        })),

      clearAll: () => set({ items: [] }),
    }),
    {
      name: HISTORY_STORAGE_KEY,
      storage: createSafeStorage(),
      partialize: (state) => ({ items: state.items }),
      skipHydration: true,
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.error("[history] rehydrate failed:", error);
          state?.clearAll();
        }
        state?.setHasHydrated(true);
      },
    }
  )
);
