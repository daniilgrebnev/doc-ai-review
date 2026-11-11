"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface ResultLayoutProps {
  doc: React.ReactNode;
  side: React.ReactNode;
  sideLabel: string;
  sideCount?: number;
}

/** Two columns on desktop (contract | findings), two tabs on a phone */
export function ResultLayout({ doc, side, sideLabel, sideCount }: ResultLayoutProps) {
  const [tab, setTab] = useState<"side" | "doc">("side");
  return (
    <>
      <div role="tablist" aria-label="View" className="flex border-b border-line px-4 lg:hidden">
        {(["side", "doc"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn(
              "flex min-h-[44px] flex-1 items-center justify-center gap-1.5 border-b-2 border-transparent text-sm text-muted",
              tab === t && "border-ink font-semibold text-ink"
            )}
          >
            {t === "side" ? sideLabel : "Contract"}
            {t === "side" && sideCount !== undefined && <span className="font-mono text-xs">{sideCount}</span>}
          </button>
        ))}
      </div>
      <main className="flex flex-1 flex-col lg:flex-row">
        <section
          aria-label="Contract text"
          className={cn("min-w-0 bg-white lg:block lg:flex-[3_1_560px] lg:border-r lg:border-line", tab === "doc" ? "block" : "hidden")}
        >
          {doc}
        </section>
        <aside
          aria-label={sideLabel}
          className={cn("min-w-0 flex-col gap-4 px-4 pb-10 pt-5 sm:px-6 lg:flex lg:flex-[2_1_380px]", tab === "side" ? "flex" : "hidden")}
        >
          {side}
        </aside>
      </main>
    </>
  );
}
