import { describe, expect, it } from "vitest";
import { parseRevisedText } from "@/lib/agents/revise-parser";

describe("parseRevisedText", () => {
  it("strips wrapper prefix", () => {
    const text = parseRevisedText("Исправленный документ:\n\nДоговор поставки");
    expect(text).toBe("Договор поставки");
  });

  it("returns null for model refusal", () => {
    const text = parseRevisedText(
      "Я не могу обсуждать эту тему. Давайте поговорим о чём-нибудь ещё."
    );
    expect(text).toBeNull();
  });
});
