import { getDefect, getRequirement } from "@/lib/check/catalog";
import { locateQuotes } from "@/lib/check/spans";
import type { DefectCode, Finding, FindingVerdict, RequirementId } from "@/lib/check/types";

const VERDICTS: FindingVerdict[] = ["violation", "risk", "compliant"];

function extractJson(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = (fenced ? fenced[1] : raw).trim();
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(body.slice(start, end + 1));
  } catch {
    return null;
  }
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/** Parses the model answer into findings and checks every quote against the text */
export function parseFindings(raw: string, text: string): Finding[] | null {
  const data = extractJson(raw) as { findings?: unknown } | null;
  if (!data || !Array.isArray(data.findings)) return null;

  const out: Finding[] = [];
  data.findings.forEach((item: Record<string, unknown>, i: number) => {
    if (!item || typeof item !== "object") return;
    const verdict = str(item.verdict).toLowerCase() as FindingVerdict;
    if (!VERDICTS.includes(verdict)) return;

    const defectRaw = str(item.defect).toUpperCase();
    const defect = getDefect(defectRaw) ? (defectRaw as DefectCode) : null;
    let requirement = str(item.requirement).toUpperCase();
    if (!getRequirement(requirement) && defect) requirement = getDefect(defect)!.requirement;
    if (!getRequirement(requirement)) return;

    const quotes = (Array.isArray(item.quotes) ? item.quotes : [item.quote])
      .map(str)
      .filter(Boolean);
    if (quotes.length === 0) return;

    const confidence = Math.min(1, Math.max(0, Number(item.confidence) || 0));
    const located = locateQuotes(text, quotes);

    out.push({
      id: `f${i + 1}`,
      verdict,
      defect: verdict === "compliant" ? null : defect,
      requirement: requirement as RequirementId,
      clause: str(item.clause),
      title: str(item.title) || (defect ? getDefect(defect)!.name : getRequirement(requirement)!.name),
      quotes,
      reason: str(item.reason),
      confidence,
      ...located,
    });
  });

  const order: Record<FindingVerdict, number> = { violation: 0, risk: 1, compliant: 2 };
  return out.sort((a, b) => order[a.verdict] - order[b.verdict]);
}
