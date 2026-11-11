import { Page } from "@/components/cc/Header";
import { getMonitoringData, type MonitoringData, type Totals } from "@/lib/db/monitoring";
import { formatModelLabel } from "@/lib/llm/model-label";
import { cn } from "@/lib/utils";
import { RefreshButton } from "./RefreshButton";

export const dynamic = "force-dynamic";

const fmtInt = (v: number) => v.toLocaleString("en-US");
const fmtUsd = (v: number | null) => (v == null ? "—" : v < 0.01 ? `$${v.toFixed(4)}` : `$${v.toFixed(2)}`);
const fmtSec = (ms: number | null) => (ms == null ? "—" : `${(ms / 1000).toFixed(1)} s`);
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" });

const STATUS_LABEL: Record<string, string> = {
  ok: "ok",
  failed: "failed",
  input_error: "bad input",
  blocked: "geo blocked",
  no_model: "no model",
  limited: "over limit",
};

function Stats({ t, label }: { t: Totals; label: string }) {
  const items: Array<[string, string]> = [
    [fmtInt(t.runs), `runs${t.runs ? ` · ${Math.round((t.ok / t.runs) * 100)}% ok` : ""}`],
    [fmtUsd(t.costUsd), "token cost"],
    [fmtInt(t.inputTokens + t.outputTokens), `tokens · ${fmtInt(t.inputTokens)} in / ${fmtInt(t.outputTokens)} out`],
    [fmtSec(t.p50Ms), `model p50 · p95 ${fmtSec(t.p95Ms)}`],
  ];
  return (
    <section aria-label={label} className="flex flex-col gap-2">
      <h2 className="m-0 text-sm font-semibold text-muted">{label}</h2>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-x-8">
        {items.map(([value, caption]) => (
          <div key={caption} className="flex flex-col gap-0.5 border-t border-ink py-4">
            <span className="font-mono text-[28px] font-medium leading-tight tracking-tight">{value}</span>
            <span className="text-[13px] text-muted">{caption}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

const th = "whitespace-nowrap border-b border-line-2 px-3 py-2.5 font-semibold";
const td = "whitespace-nowrap border-b border-line px-3 py-2.5";

function Content({ data }: { data: MonitoringData }) {
  if (data.totals.runs === 0) {
    return (
      <section className="rounded-lg border border-dashed border-line-2 p-6 text-ink-2">
        No runs yet. Every check and generation will show up here.
      </section>
    );
  }
  return (
    <>
      <Stats t={data.last24h} label="Last 24 hours" />
      <Stats t={data.totals} label="All time" />

      <section className="flex flex-col gap-3.5">
        <div className="flex flex-wrap items-baseline gap-3">
          <h2 className="m-0 text-lg">By model</h2>
          <span className="text-[13px] text-muted">
            {data.byRoute.map((r) => `${r.route}: ${fmtInt(r.runs)} runs, ${fmtUsd(r.costUsd)}`).join(" · ")}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className={th}>Model</th>
                <th className={cn(th, "text-right")}>Runs</th>
                <th className={cn(th, "text-right")}>Tokens in</th>
                <th className={cn(th, "text-right")}>Tokens out</th>
                <th className={cn(th, "text-right")}>Avg time</th>
                <th className={cn(th, "text-right")}>Cost</th>
                <th className={cn(th, "text-right")}>Per run</th>
              </tr>
            </thead>
            <tbody>
              {data.byModel.map((m) => (
                <tr key={m.model}>
                  <td className={cn(td, "font-semibold")}>
                    {formatModelLabel(m.model)} <span className="font-mono text-xs font-normal text-muted">{m.model}</span>
                  </td>
                  <td className={cn(td, "text-right font-mono")}>{fmtInt(m.runs)}</td>
                  <td className={cn(td, "text-right font-mono")}>{fmtInt(m.inputTokens)}</td>
                  <td className={cn(td, "text-right font-mono")}>{fmtInt(m.outputTokens)}</td>
                  <td className={cn(td, "text-right font-mono")}>{fmtSec(m.avgMs)}</td>
                  <td className={cn(td, "text-right font-mono")}>{fmtUsd(m.costUsd)}</td>
                  <td className={cn(td, "text-right font-mono")}>{fmtUsd(m.runs ? m.costUsd / m.runs : null)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-col gap-3.5">
        <div className="flex flex-wrap items-baseline gap-3">
          <h2 className="m-0 text-lg">Recent requests</h2>
          <span className="text-[13px] text-muted">last {data.runs.length}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className={th}>Time</th>
                <th className={th}>Type</th>
                <th className={th}>Status</th>
                <th className={th}>Document</th>
                <th className={th}>Model</th>
                <th className={cn(th, "text-right")}>Findings</th>
                <th className={cn(th, "text-right")}>Tokens in / out</th>
                <th className={cn(th, "text-right")}>Time</th>
                <th className={cn(th, "text-right")}>Cost</th>
              </tr>
            </thead>
            <tbody>
              {data.runs.map((r) => (
                <tr key={r.id} className="align-top">
                  <td className={cn(td, "font-mono text-xs text-muted")}>{fmtTime(r.createdAt)}</td>
                  <td className={td}>{r.route}</td>
                  <td className={td}>
                    <span className={cn("font-medium", r.status === "ok" ? "text-ok" : r.status === "input_error" ? "text-muted" : "text-bad")} title={r.error ?? undefined}>
                      {STATUS_LABEL[r.status] ?? r.status}
                    </span>
                  </td>
                  <td className={cn(td, "max-w-[280px]")}>
                    <span className="block truncate" title={r.docTitle ?? undefined}>{r.docTitle ?? "—"}</span>
                    <span className="text-xs text-muted">
                      {r.docChars != null ? `${fmtInt(r.docChars)} chars` : ""}
                      {r.docClauses != null ? ` · ${r.docClauses} clauses` : ""}
                    </span>
                  </td>
                  <td className={td}>
                    {r.model ? formatModelLabel(r.model) : "—"}
                    {r.fallbackFrom && <span className="block text-xs text-muted">fallback from {r.fallbackFrom}</span>}
                  </td>
                  <td className={cn(td, "text-right font-mono")}>
                    {r.findingsCount == null
                      ? "—"
                      : r.route === "generate"
                        ? `${r.findingsCount} traps${r.findingsExact != null ? ` (${r.findingsExact} verified)` : ""}`
                        : `${r.findingsCount}${r.findingsExact != null ? ` (${r.findingsExact} exact)` : ""}`}
                  </td>
                  <td className={cn(td, "text-right font-mono")}>
                    {r.inputTokens == null ? "—" : `${fmtInt(r.inputTokens)} / ${fmtInt(r.outputTokens ?? 0)}`}
                  </td>
                  <td className={cn(td, "text-right font-mono")}>{fmtSec(r.modelMs ?? r.durationMs)}</td>
                  <td className={cn(td, "text-right font-mono")}>{fmtUsd(r.costUsd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

export default async function MonitoringPage() {
  let data: MonitoringData | null = null;
  let failed = false;
  try {
    data = await getMonitoringData(100);
  } catch (error) {
    console.error("[monitoring]", error);
    failed = true;
  }

  return (
    <Page>
      <main className="mx-auto box-border flex w-full max-w-[1200px] flex-1 flex-col gap-10 px-4 pb-16 pt-10 sm:px-8 sm:pt-12">
        <section className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-2.5">
            <h1 className="m-0 text-[28px] font-bold tracking-tight">Request monitoring</h1>
            <p className="m-0 max-w-[680px] text-ink-2">Every check and generation: document, model, tokens, time and token cost.</p>
          </div>
          <RefreshButton />
        </section>
        {failed ? (
          <section className="rounded-lg border border-bad p-6 text-bad">Could not read the log from the database.</section>
        ) : !data ? (
          <section className="rounded-lg border border-dashed border-line-2 p-6 text-ink-2">
            Logging is off: set <span className="font-mono">DATABASE_URL</span> in <span className="font-mono">.env.local</span>.
          </section>
        ) : (
          <Content data={data} />
        )}
      </main>
    </Page>
  );
}
