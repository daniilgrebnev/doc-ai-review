"use client";

import type { CascadeLevel, CascadeState, Dispute } from "@/lib/check/cascade";
import { formatModelLabel } from "@/lib/llm/model-label";
import { cn } from "@/lib/utils";

const nf = new Intl.NumberFormat("en-US");

function money(v: number | null | undefined): string {
  if (v == null) return "—";
  if (v === 0) return "$0";
  return v < 0.01 ? `$${v.toFixed(4)}` : `$${v.toFixed(3)}`;
}

function sec(ms?: number): string {
  return ms == null ? "" : `${(ms / 1000).toFixed(1)} s`;
}

const STATUS_TEXT: Record<CascadeLevel["status"], string> = {
  pending: "waiting",
  running: "running",
  done: "done",
  failed: "failed",
  skipped: "not needed",
};

const REASON_TEXT: Record<Dispute["reason"], string> = {
  "inexact-quote": "quote not found verbatim",
  "low-confidence": "low confidence",
  uncovered: "no verdict",
};

/** Live view of the model cascade: what each level read, what it cost, and why level 2 was called */
export function CascadePanel({ cascade }: { cascade: CascadeState }) {
  const [l1, l2] = cascade.levels;
  const disputes = cascade.triage?.disputes ?? [];
  const calls = cascade.levels.filter((l) => l.status === "done").length;

  return (
    <section aria-label="Model cascade" className="flex flex-col gap-3 rounded-lg border border-line bg-white p-4">
      <div className="flex flex-col gap-0.5">
        <strong className="text-[16px]">Model cascade</strong>
        <span className="text-[13px] text-muted">A cheap pass reads the whole contract. A stronger pass re-reads only the clauses it was unsure about.</span>
      </div>

      <LevelRow level={l1} textChars={cascade.textChars} />

      <div className="ml-[13px] flex flex-col gap-1.5 border-l-2 border-dashed border-line-2 py-1 pl-4">
        <span className="text-[13px] font-semibold">
          Triage
          <span className="font-normal text-muted"> · by code, confidence ≥ {cascade.threshold.toFixed(2)} and an exact quote</span>
        </span>
        {cascade.triage ? (
          <>
            <span className="text-[13px] text-ink-2">
              <span className="font-semibold text-ok">✓ {cascade.triage.accepted} confident</span>
              {disputes.length > 0 && <span className="font-semibold text-[#7A5200]"> · ! {disputes.length} uncertain</span>}
            </span>
            {disputes.length > 0 && (
              <ul className="flex flex-col gap-0.5 text-[13px]">
                {disputes.map((d, i) => (
                  <li key={`${d.requirement}-${d.findingId ?? i}`} className="flex gap-2">
                    <span className="w-[42px] flex-none font-mono text-xs leading-5 text-muted">{d.clause || d.requirement}</span>
                    <span className="min-w-0 flex-1">
                      {d.title} <span className="text-muted">· {d.reason === "low-confidence" ? d.detail : REASON_TEXT[d.reason]}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <span className="text-[13px] text-muted">after level 1</span>
        )}
      </div>

      <LevelRow level={l2} textChars={cascade.textChars} />

      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-t border-line pt-3 text-[13px]">
        <span>
          <span className="text-muted">Total </span>
          <strong className="font-mono">{money(cascade.totalCostUsd)}</strong>
        </span>
        <span className="text-muted">
          {calls} model call{calls === 1 ? "" : "s"}
        </span>
        {l2.status === "done" && l2.chars != null && (
          <span className="text-muted">level 2 read {Math.round((l2.chars / cascade.textChars) * 100)}% of the text</span>
        )}
        {l2.status === "skipped" && <span className="text-muted">every finding was confident, level 2 skipped</span>}
      </div>
    </section>
  );
}

function LevelRow({ level, textChars }: { level: CascadeLevel; textChars: number }) {
  const share = level.chars != null ? Math.max(2, Math.round((level.chars / textChars) * 100)) : 0;
  const muted = level.status === "pending" || level.status === "skipped";
  return (
    <div className={cn("flex gap-3", muted && "opacity-60")}>
      <span
        className={cn(
          "inline-flex h-7 w-7 flex-none items-center justify-center rounded-md font-mono text-xs font-semibold",
          level.level === 1 ? "bg-[#ECEAE4] text-ink" : "bg-ink text-white"
        )}
      >
        L{level.level}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <strong className="text-sm">{formatModelLabel(level.model)}</strong>
          {level.effort && <span className="font-mono text-xs text-muted">effort {level.effort}</span>}
          <span className="flex-1" />
          <span
            className={cn(
              "inline-flex items-center gap-1.5 text-xs",
              level.status === "failed" ? "text-bad" : level.status === "done" ? "text-ink-2" : "text-muted"
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "block h-2 w-2 rounded-full",
                level.status === "done" && "bg-ink",
                level.status === "running" && "cc-pulse bg-link",
                level.status === "failed" && "bg-bad",
                muted && "bg-line-2"
              )}
            />
            {STATUS_TEXT[level.status]}
          </span>
        </div>
        <span className="text-[13px] text-ink-2">{level.scope ?? (level.level === 2 ? "only the uncertain clauses" : "whole contract")}</span>
        <div aria-hidden="true" className="h-1.5 rounded-full bg-[#ECEAE4]" title="Share of the contract text this level reads">
          {share > 0 && <div className={cn("h-1.5 rounded-full", level.level === 1 ? "bg-ink-2" : "bg-link")} style={{ width: `${share}%` }} />}
        </div>
        {level.inputTokens != null && (
          <span className="font-mono text-xs text-muted">
            {nf.format(level.inputTokens)} in · {nf.format(level.outputTokens ?? 0)} out · {money(level.costUsd)} · {sec(level.ms)}
          </span>
        )}
      </div>
    </div>
  );
}
