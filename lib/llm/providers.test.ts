import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getRequestCountry, isClaudeGeoBlocked } from "@/lib/llm/geo";
import { getProvidersForRequest, resolveProvider } from "@/lib/llm/providers";

const ENV_KEYS = [
  "ANTHROPIC_API_KEY",
  "YC_API_KEY",
  "YC_FOLDER_ID",
  "GEO_COUNTRY_OVERRIDE",
  "CLAUDE_BLOCKED_COUNTRIES",
  "DEEPSEEK_API_KEY",
] as const;

const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ENV_KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
  process.env.ANTHROPIC_API_KEY = "test";
  process.env.YC_API_KEY = "test";
  process.env.YC_FOLDER_ID = "b1gtest";
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  vi.unstubAllEnvs();
});

const ru = new Headers({ "x-vercel-ip-country": "RU" });
const de = new Headers({ "x-vercel-ip-country": "DE" });

describe("geo", () => {
  it("reads country from hosting headers", () => {
    expect(getRequestCountry(new Headers({ "cf-ipcountry": "ru" }))).toBe("RU");
    expect(getRequestCountry(new Headers())).toBeNull();
  });

  it("override wins over headers", () => {
    process.env.GEO_COUNTRY_OVERRIDE = "ru";
    expect(getRequestCountry(de)).toBe("RU");
  });

  it("blocks Claude for RU by default", () => {
    expect(isClaudeGeoBlocked("RU")).toBe(true);
    expect(isClaudeGeoBlocked("DE")).toBe(false);
  });

  it("blocks unknown country only in production", () => {
    expect(isClaudeGeoBlocked(null)).toBe(false);
    vi.stubEnv("NODE_ENV", "production");
    expect(isClaudeGeoBlocked(null)).toBe(true);
  });

  it("respects CLAUDE_BLOCKED_COUNTRIES", () => {
    process.env.CLAUDE_BLOCKED_COUNTRIES = "BY, CN";
    expect(isClaudeGeoBlocked("RU")).toBe(false);
    expect(isClaudeGeoBlocked("BY")).toBe(true);
  });
});

describe("providers", () => {
  it("defaults to Claude outside Russia", () => {
    const res = getProvidersForRequest(de);
    expect(res.defaultProvider).toBe("claude");
    expect(res.providers.find((p) => p.id === "deepseek")).toMatchObject({
      configured: false,
      available: false,
    });
  });

  it("offers only YandexGPT in Russia", () => {
    const res = getProvidersForRequest(ru);
    expect(res.defaultProvider).toBe("yandex");
    expect(res.providers.find((p) => p.id === "claude")).toMatchObject({
      geoBlocked: true,
      available: false,
    });
  });

  it("rejects explicit Claude request from Russia", () => {
    expect(resolveProvider("claude", ru)).toMatchObject({ kind: "error", status: 403 });
    expect(resolveProvider("yandex", ru)).toEqual({ kind: "provider", provider: "yandex" });
  });

  it("falls back to demo when nothing is configured", () => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.YC_API_KEY;
    expect(resolveProvider(undefined, de)).toEqual({ kind: "demo" });
    expect(getProvidersForRequest(de).demo).toBe(true);
  });

  it("enables DeepSeek when key is set, also in Russia", () => {
    process.env.DEEPSEEK_API_KEY = "k";
    expect(resolveProvider("deepseek", ru)).toEqual({ kind: "provider", provider: "deepseek" });
  });

  it("rejects unknown provider", () => {
    expect(resolveProvider("gpt", de)).toMatchObject({ kind: "error", status: 400 });
  });
});
