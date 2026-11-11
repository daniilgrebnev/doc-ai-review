"use client";

import Link from "next/link";
import { CascadePanel } from "@/components/cc/CascadePanel";
import { LimitBanner } from "@/components/cc/LimitBanner";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getDefect } from "@/lib/check/catalog";
import { getExample } from "@/lib/check/examples";
import { spansOverlap } from "@/lib/check/spans";
import type { CascadeState } from "@/lib/check/cascade";
import type { CheckEvent, CheckStep, Finding } from "@/lib/check/types";
import type { AnswerKeyItem } from "@/lib/generator";
import { formatModelLabel } from "@/lib/llm/model-label";
import { cn } from "@/lib/utils";
import { DocumentView, scrollToFinding, type ExtraMark } from "@/components/cc/DocumentView";
import { Disclaimer, NoTraps } from "@/components/cc/ExamplesView";
import { FindingsList } from "@/components/cc/FindingsList";
import { ResultLayout } from "@/components/cc/ResultLayout";
import { useAgentFlowStore } from "@/store/useAgentFlowStore";

export interface LiveRunProps {
  title: string;
  subtitle?: string;
  text: string;
  /** Ready-made example to fall back to and to show on Skip */
  exampleId?: string;
  /** Answer key of a generated contract */
  answerKey?: AnswerKeyItem[];
  onBack: () => void;
}

type Status = "running" | "done" | "skipped" | "error";

interface DoneMeta {
  provider: string;
  model: string;
  ms: number;
  tokens: number;
  fallbackFrom?: string;
}

function keyFound(k: AnswerKeyItem, findings: Finding[]): boolean {
  return findings.some((f) => f.defect === k.defect && f.spans.some((s) => k.spans.some((ks) => spansOverlap(s, ks))));
}

export function LiveRun({ title, subtitle, text, exampleId, answerKey, onBack }: LiveRunProps) {
  const provider = useAgentFlowStore((s) => s.provider);
  const [steps, setSteps] = useState<CheckStep[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [status, setStatus] = useState<Status>("running");
  const [error, setError] = useState<{ kind: string; message: string } | null>(null);
  const [meta, setMeta] = useState<DoneMeta | null>(null);
  const [cascade, setCascade] = useState<CascadeState | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [run, setRun] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const example = getExample(exampleId);

  useEffect(() => {
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setSteps([]);
    setFindings([]);
    setStatus("running");
    setError(null);
    setMeta(null);
    setCascade(null);
    setSelected(null);
    const t0 = Date.now();
    const tick = setInterval(() => setElapsed(Date.now() - t0), 100);

    const apply = (e: CheckEvent) => {
      if (e.type === "step") {
        setSteps((prev) => {
          const i = prev.findIndex((s) => s.id === e.step.id);
          if (i < 0) return [...prev, e.step];
          const next = [...prev];
          next[i] = e.step;
          return next;
        });
      } else if (e.type === "cascade") {
        setCascade(e.cascade);
      } else if (e.type === "finding") {
        setFindings((prev) => [...prev, e.finding]);
      } else if (e.type === "done") {
        setMeta({ provider: e.provider, model: e.model, ms: e.ms, tokens: e.inputTokens + e.outputTokens, fallbackFrom: e.fallbackFrom });
        setStatus("done");
      } else if (e.type === "error") {
        setError({ kind: e.kind, message: e.message });
        setStatus("error");
      }
    };

    (async () => {
      try {
        const res = await fetch("/api/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, provider }),
          signal: ctrl.signal,
        });
        if (!res.body) throw new Error("no body");
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let nl: number;
          while ((nl = buf.indexOf("\n")) >= 0) {
            const line = buf.slice(0, nl).trim();
            buf = buf.slice(nl + 1);
            if (line) apply(JSON.parse(line) as CheckEvent);
          }
        }
        setStatus((s) => (s === "running" ? "error" : s));
        setError((er) => er ?? { kind: "failed", message: "The connection closed early." });
      } catch (err) {
        if (ctrl.signal.aborted) return;
        setError({ kind: "failed", message: err instanceof Error ? err.message : "Network error" });
        setStatus("error");
      } finally {
        clearInterval(tick);
        setElapsed(Date.now() - t0);
      }
    })();

    return () => {
      ctrl.abort();
      clearInterval(tick);
    };
    // provider is read once per run on purpose
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, run]);

  const canSkip = status === "running" && (Boolean(example) || Boolean(answerKey));
  const skip = useCallback(() => {
    abortRef.current?.abort();
    if (example) {
      setFindings(example.findings);
      setSelected(example.findings[0]?.id ?? null);
    }
    setStatus("skipped");
  }, [example]);

  const select = (id: string | null) => {
    setSelected(id);
    if (id) scrollToFinding(id);
  };

  const finished = status === "done" || status === "skipped";
  const extraMarks = useMemo<ExtraMark[]>(() => {
    if (!answerKey || !finished) return [];
    return answerKey
      .filter((k) => status === "skipped" || !keyFound(k, findings))
      .flatMap((k) => k.spans.map((span) => ({ span, className: status === "skipped" ? "hl-risk" : "hl-missed", title: `${k.defect} ${getDefect(k.defect)?.name ?? ""}` })));
  }, [answerKey, findings, finished, status]);

  const sec = (ms: number) => `${(ms / 1000).toFixed(1)} s`;
  const statusText =
    status === "running"
      ? `Checking · ${sec(elapsed)}`
      : status === "done" && meta
        ? `Done · ${findings.length} findings · ${sec(meta.ms)} · ${formatModelLabel(meta.model)}`
        : status === "skipped"
          ? example
            ? `Showing the ready-made result · ${formatModelLabel(example.model)}`
            : "Showing the answer key"
          : "Stopped";

  const progress = status === "running" ? Math.min(90, 10 + steps.filter((s) => s.status !== "running").length * 30) : 100;

  return (
    <>
      <div className="flex min-h-[56px] flex-wrap items-center gap-x-5 gap-y-1 border-b border-line px-4 sm:px-8">
        <strong className="text-[15px]">{title}</strong>
        <span aria-live="polite" className="text-[13px] text-muted">
          {statusText}
        </span>
        <span className="flex-1" />
        {canSkip && (
          <button type="button" onClick={skip} className="inline-flex min-h-[44px] items-center text-sm font-semibold text-link">
            Skip, show result →
          </button>
        )}
        {status !== "running" && (
          <>
            <button type="button" onClick={() => setRun((r) => r + 1)} className="inline-flex min-h-[44px] items-center text-sm font-semibold text-link">
              Run again
            </button>
            <button
              type="button"
              onClick={onBack}
              className="inline-flex min-h-[40px] items-center rounded-lg border border-line-2 bg-white px-4 text-sm font-semibold hover:bg-hover"
            >
              New check
            </button>
          </>
        )}
      </div>
      <div aria-hidden="true" className="h-0.5 bg-line">
        <div className="h-0.5 bg-ink transition-[width] duration-500" style={{ width: `${progress}%` }} />
      </div>

      <ResultLayout
        sideLabel="Findings"
        sideCount={findings.length}
        doc={<DocumentView title={title} subtitle={subtitle} text={text} findings={findings} selectedId={selected} onSelect={select} extraMarks={extraMarks} />}
        side={
          <>
            {status === "error" && error && <ErrorBox kind={error.kind} message={error.message} exampleId={exampleId} onRetry={() => setRun((r) => r + 1)} onBack={onBack} />}

            {status !== "skipped" && cascade && <CascadePanel cascade={cascade} />}

            {status !== "skipped" && (
              <section className="flex flex-col gap-2">
                <div className="flex items-baseline gap-2.5">
                  <strong className="text-lg">Agent steps</strong>
                  <span className="text-[13px] text-muted">streamed as they happen</span>
                </div>
                <ol className="flex flex-col">
                  {steps.map((s) => (
                    <li key={s.id} className="flex gap-3 border-t border-line py-2.5">
                      <span aria-hidden="true" className="w-3.5 flex-none pt-[7px]">
                        <span
                          className={cn(
                            "block h-2 w-2 rounded-full",
                            s.status === "done" && "bg-ink",
                            s.status === "running" && "cc-pulse bg-link",
                            s.status === "failed" && "bg-bad"
                          )}
                        />
                      </span>
                      <span className={cn("flex-1 text-sm", s.status === "failed" && "text-bad")}>{s.text}</span>
                      {s.ms !== undefined && s.status !== "running" && <span className="font-mono text-xs text-muted">{sec(s.ms)}</span>}
                    </li>
                  ))}
                  {status === "running" && steps.length === 0 && <li className="border-t border-line py-2.5 text-sm text-muted">Connecting…</li>}
                </ol>
                {meta?.fallbackFrom && (
                  <p className="text-[13px] text-ink-2">
                    The chosen model failed, so the check switched to the backup model.
                  </p>
                )}
              </section>
            )}

            {answerKey && finished && <AnswerKeyBox answerKey={answerKey} findings={findings} skipped={status === "skipped"} />}

            {finished && findings.length > 0 && (
              <section className="flex flex-col gap-2">
                <strong className="text-lg">{findings.length} findings</strong>
                <FindingsList findings={findings} selectedId={selected} onSelect={select} />
              </section>
            )}
            {status === "running" && findings.length > 0 && (
              <FindingsList findings={findings} selectedId={selected} onSelect={select} showFilters={false} />
            )}
            {status === "done" && findings.filter((f) => f.verdict !== "compliant").length === 0 && <NoTraps />}
            <Disclaimer />
          </>
        }
      />
    </>
  );
}

function AnswerKeyBox({ answerKey, findings, skipped }: { answerKey: AnswerKeyItem[]; findings: Finding[]; skipped: boolean }) {
  if (answerKey.length === 0) {
    const alarms = findings.filter((f) => f.verdict !== "compliant").length;
    return (
      <section className="flex flex-col gap-1 rounded-lg border border-line bg-white p-4">
        <strong>Answer key: an honest contract</strong>
        {!skipped && (
          <span className="text-sm text-ink-2">
            {alarms === 0 ? "The agent raised no false alarms." : `The agent raised ${alarms} false alarm${alarms > 1 ? "s" : ""}.`}
          </span>
        )}
      </section>
    );
  }
  const found = answerKey.filter((k) => keyFound(k, findings));
  const matched = (f: Finding) => answerKey.some((k) => f.defect === k.defect && f.spans.some((s) => k.spans.some((ks) => spansOverlap(s, ks))));
  const extra = findings.filter((f) => f.verdict !== "compliant" && !matched(f)).length;
  return (
    <section className="flex flex-col gap-2 rounded-lg border border-line bg-white p-4">
      <strong className="text-[16px]">{skipped ? `Answer key · ${answerKey.length} traps` : `Agent found ${found.length} of ${answerKey.length} traps`}</strong>
      <ul className="flex flex-col text-sm">
        {answerKey.map((k) => {
          const ok = keyFound(k, findings);
          return (
            <li key={k.defect} className="flex gap-2.5 border-t border-line py-2">
              {!skipped && <span className={cn("w-[74px] flex-none font-semibold", ok ? "text-ok" : "text-bad")}>{ok ? "✓ Found" : "✕ Missed"}</span>}
              <span className="font-mono text-xs leading-5 text-muted">{k.defect}</span>
              <span>{getDefect(k.defect)?.name}</span>
            </li>
          );
        })}
      </ul>
      {!skipped && (
        <span className="text-[13px] text-muted">
          {found.length < answerKey.length ? "Missed traps are outlined in red in the text. " : ""}
          {extra > 0 ? `${extra} finding${extra > 1 ? "s" : ""} not in the key.` : ""}
        </span>
      )}
    </section>
  );
}

function ErrorBox({ kind, message, exampleId, onRetry, onBack }: { kind: string; message: string; exampleId?: string; onRetry: () => void; onBack: () => void }) {
  if (kind === "limit") return <LimitBanner />;
  if (kind === "input") {
    return (
      <section className="flex flex-col gap-2 rounded-lg border border-line bg-white p-5">
        <strong className="text-[17px]">Can&apos;t check this text</strong>
        <span className="text-sm text-ink-2">{message}</span>
        <button type="button" onClick={onBack} className="inline-flex min-h-[44px] items-center self-start rounded-lg border border-line-2 bg-white px-4 text-sm font-semibold hover:bg-hover">
          Back to the text
        </button>
      </section>
    );
  }
  const title = kind === "blocked" ? "This model is not available in your region" : kind === "no-model" ? "Live checks are off" : "The live check didn't finish";
  const body =
    kind === "blocked"
      ? "Pick another model in the header and run the check again."
      : kind === "no-model"
        ? "No model is configured on the server. Ready-made examples still work."
        : "No model answered. The ready-made examples show how the result looks.";
  return (
    <section className="flex flex-col gap-2 rounded-lg border border-line bg-white p-5">
      <strong className="text-[17px]">{title}</strong>
      <span className="text-sm text-ink-2">{body}</span>
      <div className="flex flex-wrap items-center gap-4">
        <Link href="/" className="inline-flex min-h-[44px] items-center rounded-lg bg-ink px-4 text-sm font-semibold text-white no-underline hover:bg-[#2B2E36]">
          {exampleId ? "Open ready-made result" : "See examples"}
        </Link>
        <button type="button" onClick={onRetry} className="inline-flex min-h-[44px] items-center text-sm font-semibold text-link">
          Try again
        </button>
      </div>
      <span className="text-xs text-muted">{message}</span>
    </section>
  );
}
