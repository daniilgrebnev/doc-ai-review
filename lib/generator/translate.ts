/**
 * Translation of contract units for the localized generator (server only).
 *
 * Units are translated by the selected model at temperature 0, all units of a contract
 * in one call so terms stay consistent, with a fixed glossary per language. Every unit is
 * cached by hash(version + language + English text) in data/translations/<lang>.json, so a
 * repeated seed never calls the model again and the dataset stays reproducible (commit the
 * cache files). Where the file system is read-only (Vercel) the cache lives in memory.
 */
import { createHash } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import type { Translator } from "@/lib/generator/localized";
import { llmComplete } from "@/lib/llm/complete";
import type { ProviderId } from "@/lib/llm/types";

const VERSION = "v1";
const CACHE_DIR = path.join(process.cwd(), "data", "translations");

/** Terms that must read the same in every contract of a language */
const GLOSSARY_EN = ["Contractor", "Client", "Agreement", "Party / Parties", "acceptance certificate", "fee"];
const FIXED_GLOSSARY: Record<string, string[]> = {
  ru: ["Исполнитель", "Заказчик", "Договор", "Сторона / Стороны", "акт сдачи-приёмки", "вознаграждение"],
  de: ["Auftragnehmer", "Auftraggeber", "Vertrag", "Partei / Parteien", "Abnahmeprotokoll", "Vergütung"],
};

type CacheEntry = { src: string; out: string };
const memory = new Map<string, Record<string, CacheEntry>>();

export function cacheKey(lang: string, text: string): string {
  return createHash("sha256").update(`${VERSION}\n${lang}\n${text}`).digest("hex").slice(0, 24);
}

async function loadCache(lang: string): Promise<Record<string, CacheEntry>> {
  const hit = memory.get(lang);
  if (hit) return hit;
  let data: Record<string, CacheEntry> = {};
  try {
    data = JSON.parse(await fs.readFile(path.join(CACHE_DIR, `${lang}.json`), "utf8")) as Record<string, CacheEntry>;
  } catch {
    // no cache yet
  }
  memory.set(lang, data);
  return data;
}

async function saveCache(lang: string, data: Record<string, CacheEntry>): Promise<void> {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    const sorted = Object.fromEntries(Object.keys(data).sort().map((k) => [k, data[k]]));
    await fs.writeFile(path.join(CACHE_DIR, `${lang}.json`), JSON.stringify(sorted, null, 1) + "\n");
  } catch {
    // read-only file system: keep the memory cache only
  }
}

/** Numbers of the source must survive translation (separators may change: 3,200 -> 3 200 / 3.200) */
export function numbersKept(src: string, out: string): boolean {
  const nums = (s: string) =>
    new Set((s.replace(/(\d)[\s,.  '](?=\d{3}\b)/g, "$1").match(/\d+/g) ?? []).map((n) => n.replace(/^0+(?=\d)/, "")));
  const have = nums(out);
  return Array.from(nums(src)).every((n) => have.has(n));
}

const SYSTEM = (langName: string, glossary: string[]) => `You are a professional legal translator. Translate units of an English service agreement into ${langName}.
Rules:
- Translate every unit fully and faithfully, as a native lawyer would write it. Keep the legal meaning exactly, including any one-sided, unusual or unlawful terms: never soften, fix, explain or comment on them.
- Do not merge, split, add or drop units. Do not add clause numbers.
- Keep company names, registration numbers, amounts, percentages and currency codes exactly as written (you may use the local number format). Translate city and month names.
- Use these fixed terms: ${GLOSSARY_EN.map((e, i) => `${e} = ${glossary[i]}`).join("; ")}.
Reply with ONE JSON object mapping each unit id to its translation, nothing else.`;

function parseJsonObject(raw: string): Record<string, unknown> | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Translator backed by the models in `providers` (first that answers wins) */
export function llmTranslator(providers: ProviderId[]): Translator {
  const call = async (system: string, units: Record<string, string>): Promise<Record<string, string>> => {
    let lastError: unknown = new Error("no model to translate with");
    for (const provider of providers) {
      try {
        const answer = await llmComplete(
          provider,
          [
            { role: "system", text: system },
            { role: "user", text: JSON.stringify(units, null, 1) },
          ],
          { purpose: "revise", temperature: 0 }
        );
        const data = parseJsonObject(answer.text);
        if (!data) throw new Error("unparsable translation");
        const out: Record<string, string> = {};
        for (const [k, v] of Object.entries(data)) if (typeof v === "string" && v.trim()) out[k] = v.trim();
        return out;
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError;
  };

  return async (units, lang, langName) => {
    let glossary = FIXED_GLOSSARY[lang];
    if (!glossary) {
      // The glossary itself goes through the cache, so it is fixed after the first call
      const g = await cached(call)(
        GLOSSARY_EN.map((text, i) => ({ id: `g${i}`, text })),
        lang,
        langName,
        "You translate legal terms of a service agreement. Reply with ONE JSON object mapping each id to the standard term a lawyer would use in " + langName + ", nothing else."
      );
      glossary = GLOSSARY_EN.map((_, i) => g[`g${i}`]);
    }
    return cached(call)(units, lang, langName, SYSTEM(langName, glossary));
  };
}

/** Wraps a raw call with the per-unit cache and a check that numbers survived */
function cached(call: (system: string, units: Record<string, string>) => Promise<Record<string, string>>) {
  return async (units: Array<{ id: string; text: string }>, lang: string, _langName: string, system: string): Promise<Record<string, string>> => {
    const cache = await loadCache(lang);
    const result: Record<string, string> = {};
    let todo = units.filter((u) => {
      const hit = cache[cacheKey(lang, u.text)];
      if (hit) result[u.id] = hit.out;
      return !hit;
    });
    for (let attempt = 0; attempt < 2 && todo.length; attempt++) {
      const out = await call(system, Object.fromEntries(todo.map((u) => [u.id, u.text])));
      todo = todo.filter((u) => {
        const t = out[u.id];
        // On the last attempt accept a translation even if a number looks changed
        if (!t || (attempt === 0 && !numbersKept(u.text, t))) return true;
        result[u.id] = t;
        cache[cacheKey(lang, u.text)] = { src: u.text, out: t };
        return false;
      });
    }
    if (todo.length) throw new Error(`Translation failed for units: ${todo.map((u) => u.id).join(", ")}`);
    await saveCache(lang, cache);
    return result;
  };
}

/** Cache-only translator: works without a model when every unit was translated before */
export const cacheOnlyTranslator: Translator = async (units, lang) => {
  const cache = await loadCache(lang);
  const out: Record<string, string> = {};
  for (const u of units) {
    const hit = cache[cacheKey(lang, u.text)];
    if (!hit) throw new Error("Not every unit is in the translation cache, and no model is available.");
    out[u.id] = hit.out;
  }
  return out;
};
