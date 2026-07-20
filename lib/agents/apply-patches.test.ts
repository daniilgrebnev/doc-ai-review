import { describe, expect, it } from "vitest";
import { applyTextPatches, parseTextPatches } from "@/lib/agents/apply-patches";
import { parseRevisedText } from "@/lib/agents/revise-parser";
import { isRefusalText } from "@/lib/agents/refusal";

describe("applyTextPatches", () => {
  it("applies find/replace patches", () => {
    const doc = "Стороны имеют право на отказ от договора. Срок — 30 дней.";
    const patches = parseTextPatches(
      '[{"find":"Срок — 30 дней","replace":"Срок — 14 дней"}]'
    );
    const { text, applied } = applyTextPatches(doc, patches);
    expect(applied).toBe(1);
    expect(text).toContain("14 дней");
  });
});

describe("parseRevisedText", () => {
  it("accepts long contract with word отказ", () => {
    const contract =
      "Договор поставки. ".repeat(50) +
      "Сторона вправе заявить об отказе от исполнения обязательств.";
    expect(isRefusalText(contract)).toBe(false);
    expect(parseRevisedText(contract)).toBe(contract);
  });

  it("returns null for short refusal", () => {
    expect(
      parseRevisedText("Я не могу обсуждать эту тему. Давайте поговорим о чём-нибудь ещё.")
    ).toBeNull();
  });
});
