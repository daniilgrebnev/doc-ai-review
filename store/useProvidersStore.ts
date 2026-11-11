"use client";

import { create } from "zustand";
import type { ProviderId, ProviderInfo, ProvidersResponse } from "@/lib/llm/types";
import { useAgentFlowStore } from "@/store/useAgentFlowStore";

const STORAGE_KEY = "cc.provider";

interface ProvidersState {
  providers: ProviderInfo[];
  country: string | null;
  demo: boolean;
  loaded: boolean;
  load: () => Promise<void>;
  choose: (id: ProviderId) => void;
}

function readStored(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export const useProvidersStore = create<ProvidersState>((set, get) => ({
  providers: [],
  country: null,
  demo: false,
  loaded: false,
  load: async () => {
    if (get().loaded) return;
    try {
      const res = await fetch("/api/providers");
      const data = (await res.json()) as ProvidersResponse;
      set({ providers: data.providers ?? [], country: data.country, demo: Boolean(data.demo), loaded: true });
      const { provider, setProvider } = useAgentFlowStore.getState();
      const ok = (id: string | null) => data.providers?.some((p) => p.id === id && p.available);
      const stored = readStored();
      if (ok(provider)) return;
      setProvider(ok(stored) ? (stored as ProviderId) : data.defaultProvider);
    } catch {
      set({ loaded: true });
    }
  },
  choose: (id) => {
    useAgentFlowStore.getState().setProvider(id);
    try {
      window.localStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* private mode */
    }
  },
}));

export function providerReason(p: ProviderInfo): string | null {
  if (p.geoBlocked) return "Not available in your region";
  if (!p.configured) return "No API key on the server";
  return null;
}
