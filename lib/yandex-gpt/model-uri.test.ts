import { describe, expect, it } from "vitest";
import {
  buildModelUri,
  formatModelLabel,
  normalizeModelSlug,
} from "@/lib/yandex-gpt/model-uri";

describe("normalizeModelSlug", () => {
  it("strips /latest suffix", () => {
    expect(normalizeModelSlug("yandexgpt-5.1/latest")).toBe("yandexgpt-5.1");
  });

  it("maps yandexgpt-pro alias to yandexgpt", () => {
    expect(normalizeModelSlug("yandexgpt-pro")).toBe("yandexgpt");
  });

  it("parses full model URI", () => {
    expect(normalizeModelSlug("gpt://b1gabc/yandexgpt-5.1/latest")).toBe(
      "yandexgpt-5.1"
    );
  });
});

describe("buildModelUri", () => {
  it("builds correct URI for yandexgpt-5.1", () => {
    expect(buildModelUri("b1gabc123", "yandexgpt-5.1/latest")).toBe(
      "gpt://b1gabc123/yandexgpt-5.1/latest"
    );
  });

  it("builds correct URI for yandexgpt", () => {
    expect(buildModelUri("b1gabc123", "yandexgpt")).toBe(
      "gpt://b1gabc123/yandexgpt/latest"
    );
  });
});

describe("formatModelLabel", () => {
  it("labels yandexgpt-5.1", () => {
    expect(formatModelLabel("yandexgpt-5.1/latest")).toBe("YandexGPT 5.1");
  });
});
