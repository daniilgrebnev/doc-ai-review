/**
 * Model cascade for the contract check.
 *
 * Level 1: a cheap pass over the whole contract (Haiku at low effort, DeepSeek flash, YandexGPT Lite).
 * Triage: code, not the model, sorts the findings into accepted and uncertain.
 * Level 2: a stronger pass (Haiku at medium effort, DeepSeek v4-pro, YandexGPT Pro) that reads only
 * the clauses around the uncertain findings. Its verdicts replace level 1 for those requirements.
 */
import { REQUIREMENTS, getRequirement } from "@/lib/check/catalog";
import { spansOverlap } from "@/lib/check/spans";
import type { Finding, FindingVerdict, RequirementId } from "@/lib/check/types";
import type { LlmEffort } from "@/lib/claude/types";
import { computeCostUsd } from "@/lib/db/pricing";
import { getProviderModel } from "@/lib/llm/providers";
import type { ProviderId } from "@/lib/llm/types";

/** A finding below this confidence goes to level 2 (to be tuned on the eval dataset) */
export const CONFIDENCE_THRESHOLD = Number(process.env.CASCADE_CONFIDENCE_THRESHOLD) || 0.7;

/** If the uncertain clauses cover more than this share of the text, level 2 reads the whole contract */
const WHOLE_TEXT_SHARE = 0.6;

export function isCascadeEnabled(): boolean {
  return process.env.CHECK_CASCADE !== "off";
}

export interface LevelConfig {
  model: string;
  effort?: LlmEffort;
}

export interface Ladder {
  l1: LevelConfig;
  l2: LevelConfig;
}

/** Cheap and strong configuration per provider. Claude stays on one model so the prompt cache is shared. */
export function getLadder(provider: ProviderId): Ladder {
  if (provider === "claude") {
    const model = getProviderModel("claude");
    return { l1: { model, effort: "low" }, l2: { model, effort: "medium" } };
  }
  if (provider === "deepseek") {
    return {
      l1: { model: getProviderModel("deepseek") },
      l2: { model: process.env.DEEPSEEK_STRONG_MODEL?.trim() || "deepseek-v4-pro" },
    };
  }
  return {
    l1: { model: process.env.YANDEX_LITE_MODEL?.trim() || "yandexgpt-lite/latest" },
    l2: { model: getProviderModel("yandex") },
  };
}

// ---------- clauses ----------

export interface Clause {
  /** Number as written in the contract, e.g. "4.1" */
  label: string;
  start: number;
  end: number;
}

const CLAUSE_START = /^[ \t]*(\d+(?:\.\d+)*)\.?[ \t]+\S/gm;

/** Splits the contract into numbered clauses ("4.", "4.1", "4.1.2"). Text before the first number is clause "0". */
export function splitClauses(text: string): Clause[] {
  const starts: Array<{ label: string; at: number }> = [];
  const re = new RegExp(CLAUSE_START.source, "gm");
  for (let m = re.exec(text); m; m = re.exec(text)) starts.push({ label: m[1], at: m.index });
  if (starts.length === 0) return [{ label: "0", start: 0, end: text.length }];
  const clauses: Clause[] = [];
  if (starts[0].at > 0) clauses.push({ label: "0", start: 0, end: starts[0].at });
  starts.forEach((s, i) => clauses.push({ label: s.label, start: s.at, end: i + 1 < starts.length ? starts[i + 1].at : text.length }));
  return clauses;
}

// ---------- triage ----------

export type DisputeReason = "inexact-quote" | "low-confidence" | "uncovered";

export interface Dispute {
  requirement: RequirementId;
  reason: DisputeReason;
  /** Human-readable reason for the panel */
  detail: string;
  title: string;
  clause?: string;
  findingId?: string;
  verdict?: FindingVerdict;
}

export interface Triage {
  accepted: Finding[];
  disputes: Dispute[];
}

export function triage(findings: Finding[]): Triage {
  const accepted: Finding[] = [];
  const disputes: Dispute[] = [];
  for (const f of findings) {
    const base = { requirement: f.requirement, title: f.title, clause: f.clause || undefined, findingId: f.id, verdict: f.verdict };
    if (!f.exact) {
      disputes.push({ ...base, reason: "inexact-quote", detail: "quote not found verbatim" });
    } else if (f.confidence < CONFIDENCE_THRESHOLD) {
      disputes.push({ ...base, reason: "low-confidence", detail: `confidence ${f.confidence.toFixed(2)}` });
    } else {
      accepted.push(f);
    }
  }
  const covered = new Set(findings.map((f) => f.requirement));
  for (const r of REQUIREMENTS) {
    if (!covered.has(r.id)) disputes.push({ requirement: r.id, reason: "uncovered", detail: "no verdict", title: r.name });
  }
  return { accepted, disputes };
}

// ---------- escalation scope ----------

export interface Escalation {
  /** Text that level 2 reads */
  excerpt: string;
  wholeText: boolean;
  clauseLabels: string[];
  requirements: RequirementId[];
  chars: number;
}

function clauseByLabel(clauses: Clause[], ref: string | undefined): number {
  const label = ref?.replace(/[^\d.]/g, "").replace(/\.$/, "");
  return label ? clauses.findIndex((c) => c.label === label) : -1;
}

/** Picks the clauses level 2 needs: the clause of each uncertain finding plus its neighbours */
export function buildEscalation(text: string, findings: Finding[], disputes: Dispute[]): Escalation {
  const requirements = Array.from(new Set(disputes.map((d) => d.requirement)));
  const clauses = splitClauses(text);
  const picked = new Set<number>();
  let whole = disputes.some((d) => d.reason === "uncovered") || clauses.length < 3;

  for (const d of disputes) {
    if (whole) break;
    const f = findings.find((x) => x.id === d.findingId);
    const hits = new Set<number>();
    for (const span of f?.spans ?? []) {
      clauses.forEach((c, i) => spansOverlap([c.start, c.end], span) && hits.add(i));
    }
    const byLabel = clauseByLabel(clauses, d.clause);
    if (byLabel >= 0) hits.add(byLabel);
    if (hits.size === 0) {
      whole = true;
      break;
    }
    for (const i of Array.from(hits)) [i - 1, i, i + 1].filter((j) => j >= 0 && j < clauses.length).forEach((j) => picked.add(j));
  }

  const order = Array.from(picked).sort((a, b) => a - b);
  const chars = order.reduce((n, i) => n + (clauses[i].end - clauses[i].start), 0);
  if (whole || chars > text.length * WHOLE_TEXT_SHARE) {
    return { excerpt: text, wholeText: true, clauseLabels: [], requirements, chars: text.length };
  }

  const parts: string[] = [];
  order.forEach((i, k) => {
    if (k > 0 && order[k - 1] !== i - 1) parts.push("[…]");
    parts.push(text.slice(clauses[i].start, clauses[i].end).trimEnd());
  });
  return {
    excerpt: parts.join("\n"),
    wholeText: false,
    clauseLabels: order.map((i) => clauses[i].label).filter((l) => l !== "0"),
    requirements,
    chars,
  };
}

export function buildLevel2Message(esc: Escalation, disputes: Dispute[]): string {
  const lines = disputes.map((d) => {
    const req = getRequirement(d.requirement);
    const where = d.clause ? `, ${d.clause}` : "";
    const what = d.reason === "uncovered" ? "the first pass gave no verdict" : `the first pass said "${d.title}" (${d.verdict}), but ${d.detail}`;
    return `- ${d.requirement} ${req?.name ?? ""}${where}: ${what}.`;
  });
  return `<contract>
${esc.excerpt}
</contract>

${esc.wholeText ? "This is the whole contract." : "This is an excerpt of the contract: only the clauses that need a second look. […] marks skipped clauses."}
A faster first pass was unsure about these points. Check them again carefully:
${lines.join("\n")}

Report findings only for ${esc.requirements.join(", ")}. Copy every quote verbatim from the text above.`;
}

/** Level 2 verdicts replace level 1 for the disputed requirements; confident level 1 findings stay */
export function mergeFindings(accepted: Finding[], level2: Finding[], requirements: RequirementId[]): Finding[] {
  const scope = new Set(requirements);
  const keep = accepted.map((f) => ({ ...f, level: 1 as const }));
  const added = level2
    .filter((f) => scope.has(f.requirement))
    .filter((f) => !keep.some((a) => a.requirement === f.requirement && a.spans.some((s) => f.spans.some((t) => spansOverlap(s, t)))))
    .map((f) => ({ ...f, level: 2 as const }));
  const order: Record<FindingVerdict, number> = { violation: 0, risk: 1, compliant: 2 };
  return [...keep, ...added].sort((a, b) => order[a.verdict] - order[b.verdict]).map((f, i) => ({ ...f, id: `f${i + 1}` }));
}

// ---------- state for the UI and the log ----------

export type LevelStatus = "pending" | "running" | "done" | "failed" | "skipped";

export interface CascadeLevel {
  level: 1 | 2;
  provider: ProviderId;
  model: string;
  effort?: LlmEffort;
  status: LevelStatus;
  /** What the level reads, e.g. "whole contract · 14 clauses" */
  scope?: string;
  chars?: number;
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number | null;
  ms?: number;
}

export interface CascadeState {
  textChars: number;
  clauses: number;
  threshold: number;
  levels: [CascadeLevel, CascadeLevel];
  triage?: { accepted: number; disputes: Dispute[] };
  totalCostUsd?: number | null;
}

export function levelCost(l: CascadeLevel): number | null {
  if (l.inputTokens == null || l.outputTokens == null) return null;
  return computeCostUsd(l.model, l.inputTokens, l.outputTokens);
}

export function totalCost(levels: CascadeLevel[]): number | null {
  let sum = 0;
  for (const l of levels) {
    if (l.inputTokens == null) continue;
    const c = levelCost(l);
    if (c == null) return null;
    sum += c;
  }
  return Math.round(sum * 1e6) / 1e6;
}
