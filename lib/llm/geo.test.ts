import { afterEach, describe, expect, it } from "vitest";
import { isSiteGeoBlocked } from "./geo";

describe("isSiteGeoBlocked", () => {
  const original = process.env.SITE_BLOCKED_COUNTRIES;
  afterEach(() => {
    if (original === undefined) delete process.env.SITE_BLOCKED_COUNTRIES;
    else process.env.SITE_BLOCKED_COUNTRIES = original;
  });

  it("blocks UA by default and lets others through", () => {
    delete process.env.SITE_BLOCKED_COUNTRIES;
    expect(isSiteGeoBlocked("UA")).toBe(true);
    expect(isSiteGeoBlocked("RU")).toBe(false);
    expect(isSiteGeoBlocked(null)).toBe(false);
  });

  it("reads the list from env and can be switched off", () => {
    process.env.SITE_BLOCKED_COUNTRIES = "ua, by";
    expect(isSiteGeoBlocked("BY")).toBe(true);
    process.env.SITE_BLOCKED_COUNTRIES = "";
    expect(isSiteGeoBlocked("UA")).toBe(false);
  });
});
