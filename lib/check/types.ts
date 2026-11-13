/** Contract Check: data model of a finding (see ТЗ, F2) */
import type { CascadeState } from "@/lib/check/cascade";
import type { LawState, LegalFinding } from "@/lib/check/law";

export type FindingVerdict = "violation" | "risk" | "compliant";

export type DefectCode = "D1" | "D2" | "D3" | "D4" | "D5" | "D6" | "D7";
export type RequirementId = "R1" | "R2" | "R3" | "R4" | "R5" | "R6" | "R7";

export interface Finding {
  id: string;
  verdict: FindingVerdict;
  /** Defect type from the catalog; null for a compliant finding */
  defect: DefectCode | null;
  requirement: RequirementId;
  /** Clause reference as written in the contract, e.g. "§4.1" */
  clause: string;
  title: string;
  /** Exact fragments of the contract; D7 (contradiction) has two */
  quotes: string[];
  reason: string;
  confidence: number;
  /** Character ranges of the quotes in the text, computed on the server */
  spans: Array<[number, number]>;
  /** Every quote was found verbatim in the text */
  exact: boolean;
  /** Cascade level that produced the finding: 1 = cheap pass, 2 = re-check of uncertain points */
  level?: 1 | 2;
}

export interface CheckStep {
  id: string;
  text: string;
  status: "running" | "done" | "failed";
  ms?: number;
}

/** One line of the NDJSON stream from POST /api/check */
export type CheckEvent =
  | { type: "step"; step: CheckStep }
  | { type: "finding"; finding: Finding }
  | { type: "cascade"; cascade: CascadeState }
  /** Law check stage: governing-law guess, search, check against the found provisions */
  | { type: "law"; law: LawState }
  | { type: "legal-finding"; finding: LegalFinding }
  | {
      type: "done";
      provider: string;
      model: string;
      ms: number;
      inputTokens: number;
      outputTokens: number;
      fallbackFrom?: string;
      costUsd?: number | null;
    }
  | { type: "error"; kind: "input" | "failed" | "blocked" | "no-model" | "limit"; message: string };

export interface ContractExample {
  id: string;
  label: string;
  title: string;
  subtitle: string;
  text: string;
  findings: Finding[];
  model: string;
  checkedAt: string;
  costCents: number;
}
