"use client";

import { Check, ChevronDown, Lock } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { formatModelLabel } from "@/lib/llm/model-label";
import { cn } from "@/lib/utils";
import { providerReason, useProvidersStore } from "@/store/useProvidersStore";
import { useAgentFlowStore } from "@/store/useAgentFlowStore";

const VENDOR: Record<string, string> = { yandex: "Yandex Cloud", claude: "Anthropic", deepseek: "DeepSeek" };

export function ModelPicker() {
  const { providers, loaded, load, choose, demo } = useProvidersStore();
  const provider = useAgentFlowStore((s) => s.provider);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = providers.find((p) => p.id === provider);
  const label = !loaded ? "…" : current ? formatModelLabel(current.model) : demo ? "Demo, no model" : "None";
  const blocked = providers.find((p) => p.geoBlocked);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex min-h-[36px] items-center gap-2 rounded-lg border border-line-2 bg-white px-3 text-sm font-medium hover:bg-hover",
          open && "border-ink"
        )}
      >
        <span className="text-muted max-sm:hidden">Model</span>
        {label}
        <ChevronDown size={14} aria-hidden="true" className={cn("transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div
          role="listbox"
          aria-label="Model"
          className="absolute right-0 top-[calc(100%+6px)] z-30 flex w-[320px] max-w-[calc(100vw-32px)] flex-col rounded-[10px] border border-line-2 bg-white p-1.5 shadow-[0_12px_32px_-16px_rgba(22,24,29,.35)]"
        >
          {providers.map((p) => {
            const reason = providerReason(p);
            const selected = p.id === provider;
            return (
              <button
                key={p.id}
                type="button"
                role="option"
                aria-selected={selected}
                aria-disabled={!p.available}
                disabled={!p.available}
                onClick={() => {
                  choose(p.id);
                  setOpen(false);
                }}
                className="flex min-h-[52px] items-start gap-3 rounded-md px-3 py-2.5 text-left hover:bg-well disabled:cursor-not-allowed disabled:hover:bg-transparent"
              >
                <span className="mt-[3px] w-4 flex-none" aria-hidden="true">
                  {selected ? <Check size={16} strokeWidth={2.4} /> : !p.available ? <Lock size={16} className="text-muted" /> : null}
                </span>
                <span className="flex flex-col">
                  <strong className={cn("text-sm", !p.available && "text-muted")}>{formatModelLabel(p.model)}</strong>
                  <span className="text-[13px] text-muted">{reason ?? VENDOR[p.id] ?? p.label}</span>
                </span>
              </button>
            );
          })}
          {providers.length === 0 && <p className="px-3 py-2 text-[13px] text-muted">No models configured. Ready-made examples still work.</p>}
          <div className="mx-1.5 mt-1.5 border-t border-line px-1.5 pb-1.5 pt-2.5 text-[13px] text-muted">
            {blocked?.geoBlocked
              ? `${blocked.label} is not served in your region, so it is off here.`
              : "Applies to live checks. Ready-made examples keep their model."}
          </div>
        </div>
      )}
    </div>
  );
}
