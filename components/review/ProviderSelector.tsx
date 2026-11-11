"use client";

import { formatModelLabel } from "@/lib/llm/model-label";
import type { ProviderId, ProviderInfo } from "@/lib/llm/types";
import { cn } from "@/lib/utils";

interface ProviderSelectorProps {
  providers: ProviderInfo[];
  value: ProviderId | null;
  onChange: (provider: ProviderId) => void;
  disabled?: boolean;
}

function unavailableReason(p: ProviderInfo): string | null {
  if (p.geoBlocked) return "Недоступно в вашем регионе";
  if (!p.configured) return "Не настроен ключ API";
  return null;
}

export function ProviderSelector({ providers, value, onChange, disabled }: ProviderSelectorProps) {
  if (providers.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm" role="radiogroup" aria-label="Нейросеть">
      <span className="text-xs text-muted">Нейросеть:</span>
      {providers.map((p) => {
        const reason = unavailableReason(p);
        const selected = value === p.id;
        return (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled || !p.available}
            title={reason ?? formatModelLabel(p.model)}
            onClick={() => onChange(p.id)}
            className={cn(
              "rounded-md border px-2.5 py-1 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40",
              selected
                ? "border-accent bg-accent text-white"
                : "border-border bg-white text-neutral-700 hover:bg-neutral-50"
            )}
          >
            {p.label}
            <span className={cn("ml-1", selected ? "text-white/80" : "text-muted")}>
              {reason ? `· ${reason}` : `· ${formatModelLabel(p.model)}`}
            </span>
          </button>
        );
      })}
    </div>
  );
}
