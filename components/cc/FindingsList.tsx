"use client";

import { useState } from "react";
import { getRequirement } from "@/lib/check/catalog";
import type { Finding, FindingVerdict } from "@/lib/check/types";
import { cn } from "@/lib/utils";
import { VERDICT_META, VerdictLabel } from "@/components/cc/verdict";

interface FindingsListProps {
  findings: Finding[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  showFilters?: boolean;
}

type Filter = "all" | FindingVerdict;

export function FindingsList({ findings, selectedId, onSelect, showFilters = true }: FindingsListProps) {
  const [filter, setFilter] = useState<Filter>("all");
  const count = (v: FindingVerdict) => findings.filter((f) => f.verdict === v).length;
  const shown = findings.filter((f) => filter === "all" || f.verdict === filter);

  const filters: Array<[Filter, string]> = [
    ["all", "All"],
    ...(["violation", "risk", "compliant"] as FindingVerdict[])
      .filter((v) => count(v) > 0)
      .map((v): [Filter, string] => [v, `${VERDICT_META[v].glyph} ${VERDICT_META[v].plural} ${count(v)}`]),
  ];

  return (
    <div className="flex flex-col gap-3">
      {showFilters && filters.length > 2 && (
        <div role="group" aria-label="Filter by verdict" className="flex flex-wrap gap-1">
          {filters.map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={filter === id}
              onClick={() => setFilter(id)}
              className={cn(
                "min-h-[32px] rounded-md px-2.5 text-[13px] text-muted hover:text-ink",
                filter === id && "bg-ink text-white hover:text-white"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      <ul className="flex flex-col gap-0.5">
        {shown.map((f) => {
          const open = f.id === selectedId;
          const req = getRequirement(f.requirement);
          return (
            <li key={f.id}>
              <button
                type="button"
                aria-expanded={open}
                onClick={() => onSelect(open ? null : f.id)}
                className={cn(
                  "flex min-h-[44px] w-full flex-col gap-2 rounded-lg border border-transparent px-3.5 py-3 text-left hover:bg-hover",
                  open && "border-line-2 bg-white hover:bg-white"
                )}
              >
                <span className="flex w-full items-baseline gap-3">
                  <VerdictLabel verdict={f.verdict} className="w-[96px] flex-none" />
                  <span className="flex-1 font-semibold">{f.title}</span>
                  {f.clause && <span className="font-mono text-xs text-muted">{f.clause}</span>}
                </span>
                {open && (
                  <span className="flex flex-col gap-2 sm:pl-[108px]">
                    {f.quotes.map((q, i) => (
                      <span key={i} className="font-serif italic text-[#2A2C31]">“{q}”</span>
                    ))}
                    {f.reason && <span className="text-sm text-ink-2">{f.reason}</span>}
                    <span className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted">
                      <span>
                        {f.requirement}
                        {req ? ` · ${req.name}` : ""}
                      </span>
                      {f.defect && <span className="font-mono">{f.defect}</span>}
                      <span className="font-mono">conf. {f.confidence.toFixed(2)}</span>
                      {!f.exact && <span className="font-semibold text-risk">Quote not found in the text</span>}
                    </span>
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
