import { readFile } from "fs/promises";
import path from "path";
import { DEFECTS } from "@/lib/check/catalog";
import { formatModelLabel } from "@/lib/llm/model-label";
import { Page } from "@/components/cc/Header";

export const dynamic = "force-dynamic";

/** Shape of evals/results/latest.json written by `npm run evals` (stage 2) */
interface Metrics {
  precision: number;
  recall: number;
  citationAccuracy: number;
  falseAlarmsPerHonest: number;
  costCents: number;
  p50Ms: number;
  p95Ms: number;
}
interface EvalResults {
  version: string;
  promptsVersion: string;
  runAt: string;
  split: string;
  contracts: number;
  honest: number;
  command: string;
  models: Array<{ model: string; metrics: Metrics; recallByDefect?: Record<string, number> }>;
}

async function loadResults(): Promise<EvalResults | null> {
  try {
    const raw = await readFile(path.join(process.cwd(), "evals", "results", "latest.json"), "utf8");
    return JSON.parse(raw) as EvalResults;
  } catch {
    return null;
  }
}

const METRICS: Array<[keyof Metrics, string, (v: number) => string]> = [
  ["precision", "precision", (v) => v.toFixed(2)],
  ["recall", "recall", (v) => v.toFixed(2)],
  ["citationAccuracy", "quote accuracy", (v) => v.toFixed(2)],
  ["falseAlarmsPerHonest", "false alarms per honest contract", (v) => v.toFixed(1)],
  ["costCents", "per check", (v) => `${v.toFixed(1)} ¢`],
  ["p50Ms", "p50 latency", (v) => `${(v / 1000).toFixed(1)} s`],
];

export default async function QualityPage() {
  const data = await loadResults();
  const main = data?.models[0];

  return (
    <Page>
      <main className="mx-auto box-border flex w-full max-w-[1080px] flex-1 flex-col gap-12 px-4 pb-16 pt-10 sm:px-8 sm:pt-12">
        <section className="flex flex-col gap-2.5">
          <h1 className="m-0 text-[28px] font-bold tracking-tight">How well the agent works</h1>
          <p className="m-0 max-w-[680px] text-ink-2">
            Measured on a test set of generated contracts with a known answer key, some of them honest. A finding counts as correct when the
            trap type matches and its quote overlaps the labelled fragment.
          </p>
          {data && main && (
            <p className="m-0 text-[13px] text-muted">
              <span className="font-mono">
                v {data.version} · prompts {data.promptsVersion} · {formatModelLabel(main.model)}
              </span>{" "}
              · {data.split} set, {data.contracts} contracts ({data.honest} honest) · run {data.runAt}
            </p>
          )}
        </section>

        {!data || !main ? (
          <section className="flex flex-col gap-3 rounded-lg border border-dashed border-line-2 p-6">
            <strong className="text-lg">No baseline yet</strong>
            <span className="max-w-[640px] text-sm text-ink-2">
              The numbers appear here after the first evals run. Until then this page does not show sample figures, so nothing on it is made
              up.
            </span>
            <code className="block overflow-x-auto whitespace-nowrap rounded-md bg-well px-3.5 py-3 font-mono text-sm">npm run evals -- --split test</code>
            <span className="text-[13px] text-muted">
              Writes <span className="font-mono">evals/results/latest.json</span>: precision, recall, quote accuracy, false alarms on honest
              contracts, cost and latency, per model and per trap type.
            </span>
          </section>
        ) : (
          <>
            <section aria-label="Key metrics" className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-x-8">
              {METRICS.map(([k, label, fmt]) => (
                <div key={k} className="flex flex-col gap-0.5 border-t border-ink py-5">
                  <span className="font-mono text-[34px] font-medium leading-tight tracking-tight">{fmt(main.metrics[k])}</span>
                  <span className="text-[13px] text-muted">
                    {label}
                    {k === "p50Ms" ? ` · p95 ${(main.metrics.p95Ms / 1000).toFixed(1)} s` : ""}
                  </span>
                </div>
              ))}
            </section>

            {data.models.length > 1 && (
              <section className="flex flex-col gap-3.5">
                <div className="flex flex-wrap items-baseline gap-3">
                  <h2 className="m-0 text-lg">By model</h2>
                  <span className="text-[13px] text-muted">same test set, same prompts</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="text-left text-xs text-muted">
                        <th className="border-b border-line-2 px-3 py-2.5 font-semibold">Model</th>
                        {METRICS.map(([k, label]) => (
                          <th key={k} className="whitespace-nowrap border-b border-line-2 px-3 py-2.5 text-right font-semibold">
                            {label.split(" ")[0]}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.models.map((m) => (
                        <tr key={m.model}>
                          <td className="whitespace-nowrap border-b border-line px-3 py-3 font-semibold">{formatModelLabel(m.model)}</td>
                          {METRICS.map(([k, , fmt]) => (
                            <td key={k} className="whitespace-nowrap border-b border-line px-3 py-3 text-right font-mono">
                              {fmt(m.metrics[k])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {main.recallByDefect && (
              <section className="flex flex-col gap-3.5">
                <div className="flex flex-wrap items-baseline gap-3">
                  <h2 className="m-0 text-lg">By trap type</h2>
                  <span className="text-[13px] text-muted">recall, {formatModelLabel(main.model)}</span>
                </div>
                <div className="flex flex-col">
                  {(() => {
                    const values = DEFECTS.map((d) => main.recallByDefect?.[d.code]).filter((v): v is number => typeof v === "number");
                    const min = Math.min(...values);
                    return DEFECTS.map((d) => {
                      const v = main.recallByDefect?.[d.code];
                      if (typeof v !== "number") return null;
                      const weak = v === min;
                      return (
                        <div key={d.code} className="grid grid-cols-[44px_minmax(0,220px)_minmax(0,1fr)_56px] items-center gap-3 border-t border-line py-2.5 last:border-b">
                          <span className="font-mono text-xs text-muted">{d.code}</span>
                          <span>{d.name}</span>
                          <span className="h-1.5 rounded-full bg-line">
                            <span className={weak ? "block h-1.5 rounded-full bg-bad" : "block h-1.5 rounded-full bg-ink"} style={{ width: `${Math.round(v * 100)}%` }} />
                          </span>
                          <span className={weak ? "text-right font-mono text-bad" : "text-right font-mono"}>{v.toFixed(2)}</span>
                        </div>
                      );
                    });
                  })()}
                </div>
                <p className="m-0 text-[13px] text-muted">The weakest type is marked in red: that is where the next prompt change should go.</p>
              </section>
            )}

            <section className="flex flex-col gap-3 rounded-lg border border-line bg-white p-6">
              <h2 className="m-0 text-lg">Reproduce these numbers</h2>
              <code className="block overflow-x-auto whitespace-nowrap rounded-md bg-well px-3.5 py-3 font-mono text-sm">{data.command}</code>
            </section>
          </>
        )}
      </main>
    </Page>
  );
}
