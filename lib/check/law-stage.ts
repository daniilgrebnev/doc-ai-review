/**
 * Runs the law check stage for POST /api/check (server only): prepare → vector search → check.
 * Streams its own steps and findings through `send`; never throws, a failed stage leaves the
 * R1–R7 result intact. See lib/check/law.ts for the prompts and the reasoning.
 */
import { getLadder, isCascadeEnabled } from "@/lib/check/cascade";
import {
  articleJurisdiction,
  buildLawCheckMessages,
  contractClauses,
  buildPrepareMessages,
  fallbackQueries,
  HITS_PER_QUERY,
  parseLawFindings,
  parsePrepare,
  pickNorms,
  searchScope,
  type Channel,
  type JurisdictionGuess,
  type LawState,
  type LegalFinding,
} from "@/lib/check/law";
import type { CheckEvent } from "@/lib/check/types";
import { computeCostUsd } from "@/lib/db/pricing";
import { embed, lookupArticles, searchByVectors } from "@/lib/law/search";
import { llmComplete } from "@/lib/llm/complete";
import { getProviderModel } from "@/lib/llm/providers";
import type { ProviderId } from "@/lib/llm/types";

const JURISDICTION_NAMES: Record<string, string> = { RU: "Russia", DE: "Germany", EU: "EU", "US-NY": "New York", unknown: "unknown" };

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms))]);
}

export function describeGuess(g: JurisdictionGuess): string {
  const name = JURISDICTION_NAMES[g.jurisdiction] ?? g.jurisdiction;
  return g.jurisdiction === "unknown" ? "unknown" : `${name}${g.country && g.jurisdiction === "EU" ? ` (${g.country})` : ""} · ${Math.round(g.confidence * 100)}%`;
}

export async function runLawStage(
  text: string,
  provider: ProviderId,
  send: (e: CheckEvent) => void,
  since: () => number,
  timeoutMs: number
): Promise<{ law: LawState; findings: LegalFinding[] }> {
  const t0 = Date.now();
  const ladder = getLadder(provider);
  const cascadeOn = isCascadeEnabled();
  const cheap = cascadeOn ? ladder.l1 : { model: getProviderModel(provider) };
  const strong = cascadeOn ? ladder.l2 : { model: getProviderModel(provider) };
  const law: LawState = { status: "running", inputTokens: 0, outputTokens: 0, costUsd: 0 };
  const addUsage = (model: string, u: { inputTokens: number; outputTokens: number }) => {
    law.inputTokens! += u.inputTokens;
    law.outputTokens! += u.outputTokens;
    const c = computeCostUsd(model, u.inputTokens, u.outputTokens);
    law.costUsd = law.costUsd == null || c == null ? null : Math.round((law.costUsd + c) * 1e6) / 1e6;
  };
  const emit = () => send({ type: "law", law: structuredClone(law) });

  try {
    // ----- 1. Guess the governing law and write search queries -----
    send({ type: "step", step: { id: "law-guess", text: "Law · Guess the governing law from the text", status: "running" } });
    let prepared: ReturnType<typeof parsePrepare> = null;
    try {
      const a = await withTimeout(llmComplete(provider, buildPrepareMessages(text), { purpose: "analyze", temperature: 0, model: cheap.model, effort: cheap.effort }), timeoutMs);
      addUsage(a.model, a.usage);
      prepared = parsePrepare(a.text, text);
    } catch (error) {
      if (process.env.NODE_ENV === "development") console.error("[check] law prepare", error);
    }
    const guess: JurisdictionGuess = prepared?.guess ?? { jurisdiction: "unknown", country: null, confidence: 0, evidence: [] };
    const queries = prepared?.queries.length ? prepared.queries : fallbackQueries(text);
    law.guess = guess;
    law.searched = searchScope(guess);
    law.queries = queries.length;
    emit();
    send({
      type: "step",
      step: { id: "law-guess", text: `Law · Governing law: ${describeGuess(guess)}${prepared ? "" : " (guess failed)"}`, status: prepared ? "done" : "failed", ms: since() },
    });

    // ----- 2. Vector search -----
    const scope = law.searched.length ? law.searched.map((j) => JURISDICTION_NAMES[j] ?? j).join(", ") : "all jurisdictions";
    send({ type: "step", step: { id: "law-search", text: `Law · Search ${queries.length} clauses in ${scope}`, status: "running" } });
    const channels = await withTimeout(retrieve(text, queries, law.searched), timeoutMs);
    const { norms, retrieved } = pickNorms(queries, channels);
    law.retrieved = retrieved;
    law.norms = norms.length;
    emit();
    send({ type: "step", step: { id: "law-search", text: `Law · Found ${norms.length} provisions for ${queries.length} clauses in ${scope}`, status: "done", ms: since() } });
    if (norms.length === 0) throw new Error("no provisions found");

    // ----- 3. Check the clauses against the found provisions -----
    const label = `${strong.model}${strong.effort ? ` · ${strong.effort}` : ""}`;
    send({ type: "step", step: { id: "law-check", text: `Law · Check clauses against ${norms.length} provisions · ${label}`, status: "running" } });
    const answer = await withTimeout(
      llmComplete(provider, buildLawCheckMessages(text, norms, retrieved), { purpose: "analyze", temperature: 0.1, model: strong.model, effort: strong.effort }),
      timeoutMs
    );
    addUsage(answer.model, answer.usage);
    const parsed = parseLawFindings(answer.text, text, norms);
    if (!parsed) throw new Error("unparsable law check answer");
    for (const f of parsed.findings) send({ type: "legal-finding", finding: f });
    law.findings = parsed.findings.length;
    law.status = "done";
    law.ms = Date.now() - t0;
    emit();
    send({ type: "step", step: { id: "law-check", text: `Law · ${parsed.findings.length} clause${parsed.findings.length === 1 ? "" : "s"} conflict with the law`, status: "done", ms: since() } });
    return { law, findings: parsed.findings };
  } catch (error) {
    law.status = "failed";
    law.error = error instanceof Error ? error.message.slice(0, 300) : String(error);
    law.ms = Date.now() - t0;
    emit();
    send({ type: "step", step: { id: "law-check", text: `Law check failed · ${law.error}`, status: "failed", ms: since() } });
    if (process.env.NODE_ENV === "development") console.error("[check] law", error);
    return { law, findings: [] };
  }
}

/**
 * Three retrieval channels per clause, all checked against the law base:
 *  - named: articles the prepare model named, looked up directly (points closest to the question);
 *  - question: vector search with the plain-language validity question;
 *  - clause: vector search with the clause text itself.
 * Named articles outside the searched jurisdiction are dropped when the search is scoped.
 */
async function retrieve(text: string, queries: Array<{ clause: string; query: string; articles?: string[] }>, scope: string[]): Promise<Channel[]> {
  const clauseText = new Map(contractClauses(text).map((c) => [c.clause, c.text]));
  const vectors = await embed([...queries.map((q) => q.query), ...queries.map((q) => clauseText.get(q.clause) ?? q.query)]);
  const qVec = vectors.slice(0, queries.length);
  const cVec = vectors.slice(queries.length);
  const requests: Array<{ i: number; article: string; vector: number[] }> = [];
  queries.forEach((q, i) => {
    for (const a of q.articles ?? []) {
      if (scope.length === 0 || scope.includes(articleJurisdiction(a))) requests.push({ i, article: a, vector: qVec[i] });
    }
  });
  const [question, clause, lookedUp] = await Promise.all([
    searchByVectors(qVec, scope, HITS_PER_QUERY),
    searchByVectors(cVec, scope, 3),
    lookupArticles(requests.map(({ article, vector }) => ({ article, vector })), 2),
  ]);
  const named = queries.map(() => [] as typeof lookedUp[number]);
  requests.forEach((r, k) => named[r.i].push(...lookedUp[k]));
  return [
    { name: "named", hits: named, take: 2 },
    { name: "question", hits: question, take: 3 },
    { name: "clause", hits: clause, take: 1 },
  ];
}
