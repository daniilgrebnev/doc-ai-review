import type { DefectCode, RequirementId } from "@/lib/check/types";

export interface Requirement {
  id: RequirementId;
  name: string;
  /** What the checker should look for */
  rule: string;
}

export const REQUIREMENTS: Requirement[] = [
  { id: "R1", name: "Term and renewal are explicit", rule: "The term is stated and any renewal is explicit, in the term section, with a clear way to stop it." },
  { id: "R2", name: "Equal termination rights", rule: "Both parties can leave on comparable conditions." },
  { id: "R3", name: "Penalty is proportionate", rule: "Penalties are proportionate to the likely loss and preferably capped." },
  { id: "R4", name: "Deadlines are specific", rule: "Every obligation has a date or a number of days, not 'reasonable time' or 'promptly'." },
  { id: "R5", name: "Liability is capped", rule: "Liability is limited in amount; indirect losses are excluded or capped." },
  { id: "R6", name: "Terms change only by agreement", rule: "Price and other terms change only by mutual written agreement." },
  { id: "R7", name: "Clauses do not contradict", rule: "No two clauses set different rules for the same thing." },
];

export interface Defect {
  code: DefectCode;
  name: string;
  requirement: RequirementId;
  /** Expected verdict for this defect (decision for DECISIONS.md) */
  verdict: "violation" | "risk";
}

export const DEFECTS: Defect[] = [
  { code: "D1", name: "Disproportionate penalty", requirement: "R3", verdict: "violation" },
  { code: "D2", name: "One-sided exit", requirement: "R2", verdict: "violation" },
  { code: "D3", name: "Hidden auto-renewal", requirement: "R1", verdict: "risk" },
  { code: "D4", name: "Vague deadlines", requirement: "R4", verdict: "risk" },
  { code: "D5", name: "Unlimited liability", requirement: "R5", verdict: "violation" },
  { code: "D6", name: "Unilateral change of terms", requirement: "R6", verdict: "violation" },
  { code: "D7", name: "Contradiction between clauses", requirement: "R7", verdict: "violation" },
];

export function getRequirement(id: string): Requirement | undefined {
  return REQUIREMENTS.find((r) => r.id === id);
}

export function getDefect(code: string): Defect | undefined {
  return DEFECTS.find((d) => d.code === code);
}
