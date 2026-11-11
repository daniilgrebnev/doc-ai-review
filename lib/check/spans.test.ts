import { describe, expect, it } from "vitest";
import { locateQuote, locateQuotes, splitQuote } from "@/lib/check/spans";

const TEXT = "4.1. For late payment, the Client shall pay a penalty of 1%\nof the annual fee.";

describe("locateQuote", () => {
  it("finds an exact quote", () => {
    const span = locateQuote(TEXT, "the Client shall pay");
    expect(span).not.toBeNull();
    expect(TEXT.slice(span![0], span![1])).toBe("the Client shall pay");
  });

  it("ignores case and line breaks", () => {
    const span = locateQuote(TEXT, "penalty of 1% of the ANNUAL fee");
    expect(span).not.toBeNull();
    expect(TEXT.slice(span![0], span![1])).toBe("penalty of 1%\nof the annual fee");
  });

  it("returns null for an invented quote", () => {
    expect(locateQuote(TEXT, "the Contractor shall pay")).toBeNull();
  });
});

describe("locateQuotes", () => {
  it("splits a quote on an ellipsis", () => {
    expect(splitQuote("For late payment … annual fee")).toEqual(["For late payment", "annual fee"]);
    const { spans, exact } = locateQuotes(TEXT, ["For late payment … annual fee"]);
    expect(exact).toBe(true);
    expect(spans).toHaveLength(2);
  });

  it("marks a finding inexact when a quote is missing", () => {
    expect(locateQuotes(TEXT, ["nothing like this"]).exact).toBe(false);
  });
});
