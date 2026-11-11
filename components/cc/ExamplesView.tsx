"use client";

import Link from "next/link";
import { useState } from "react";
import { REQUIREMENTS } from "@/lib/check/catalog";
import { EXAMPLES } from "@/lib/check/examples";
import { formatModelLabel } from "@/lib/llm/model-label";
import { cn } from "@/lib/utils";
import { DocumentView, scrollToFinding } from "@/components/cc/DocumentView";
import { FindingsList } from "@/components/cc/FindingsList";
import { Page } from "@/components/cc/Header";
import { ResultLayout } from "@/components/cc/ResultLayout";
import { useProvidersStore } from "@/store/useProvidersStore";
import { useAgentFlowStore } from "@/store/useAgentFlowStore";

export function ExamplesView() {
  const [exId, setExId] = useState(EXAMPLES[0].id);
  const ex = EXAMPLES.find((e) => e.id === exId) ?? EXAMPLES[0];
  const [selected, setSelected] = useState<string | null>(ex.findings[0]?.id ?? null);
  const provider = useAgentFlowStore((s) => s.provider);
  const providers = useProvidersStore((s) => s.providers);
  const chosen = providers.find((p) => p.id === provider);
  const otherModel = chosen && chosen.model !== ex.model ? formatModelLabel(chosen.model) : null;

  const pickExample = (id: string) => {
    const next = EXAMPLES.find((e) => e.id === id)!;
    setExId(id);
    setSelected(next.findings[0]?.id ?? null);
  };
  const select = (id: string | null) => {
    setSelected(id);
    if (id) scrollToFinding(id);
  };

  return (
    <Page>
      <div className="flex flex-wrap items-center gap-x-7 gap-y-1 border-b border-line px-4 pt-2 sm:px-8">
        <div role="tablist" aria-label="Ready-made examples" className="-mx-4 flex max-w-[calc(100%+2rem)] gap-6 overflow-x-auto px-4 sm:mx-0 sm:max-w-full sm:px-0">
          {EXAMPLES.map((e) => (
            <button
              key={e.id}
              type="button"
              role="tab"
              aria-selected={e.id === ex.id}
              onClick={() => pickExample(e.id)}
              className={cn(
                "inline-flex min-h-[44px] flex-none items-baseline gap-2 whitespace-nowrap border-b-2 border-transparent pt-3 text-sm text-muted",
                e.id === ex.id && "border-ink font-semibold text-ink"
              )}
            >
              {e.label}
              <span className="font-mono text-xs text-muted">{e.findings.length}</span>
            </button>
          ))}
        </div>
        <span className="flex-1" />
        <span className="text-[13px] text-muted max-sm:pt-2">
          Ready-made result · {formatModelLabel(ex.model)} · {ex.costCents} ¢
        </span>
        <Link href={`/check?example=${ex.id}`} className="inline-flex min-h-[44px] items-center text-sm font-semibold no-underline">
          {otherModel ? `Re-check with ${otherModel} →` : "Re-check live →"}
        </Link>
      </div>

      <ResultLayout
        sideLabel="Findings"
        sideCount={ex.findings.length}
        doc={<DocumentView title={ex.title} subtitle={ex.subtitle} text={ex.text} findings={ex.findings} selectedId={selected} onSelect={select} />}
        side={
          ex.findings.length > 0 ? (
            <>
              <div className="flex items-baseline gap-2.5">
                <strong className="text-lg">{ex.findings.length} findings</strong>
                <span className="text-[13px] text-muted">against {REQUIREMENTS.length} requirements</span>
              </div>
              <FindingsList findings={ex.findings} selectedId={selected} onSelect={select} />
              <Disclaimer />
            </>
          ) : (
            <>
              <NoTraps />
              <Disclaimer />
            </>
          )
        }
      />
    </Page>
  );
}

export function NoTraps() {
  return (
    <div className="flex flex-col gap-1.5">
      <strong className="text-lg text-ok">✓ No traps found</strong>
      <span className="text-sm text-ink-2">
        All {REQUIREMENTS.length} requirements are met. An honest contract is in the set on purpose: it shows the agent does not invent
        problems.
      </span>
      <ul className="mt-2 flex flex-col">
        {REQUIREMENTS.map((r) => (
          <li key={r.id} className="flex gap-3 border-t border-line py-2.5 text-sm">
            <span className="text-ok" aria-hidden="true">✓</span>
            <span className="w-6 font-mono text-xs leading-5 text-muted">{r.id}</span>
            <span>{r.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Disclaimer() {
  return <p className="mt-auto pt-6 text-xs text-muted">Not legal advice. A demo of the technique.</p>;
}
