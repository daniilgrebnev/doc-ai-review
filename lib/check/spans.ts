/** Locating quotes in the contract text. The model's quote is trusted only if it is found here. */

function normalize(s: string): string {
  return s
    .replace(/[“”«»„]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/** Builds a normalized copy of text plus a map from normalized index to original index */
function normalizeWithMap(text: string): { norm: string; map: number[] } {
  const map: number[] = [];
  let norm = "";
  let prevSpace = false;
  for (let i = 0; i < text.length; i++) {
    const ch = normalize(text[i]);
    if (ch === " ") {
      if (prevSpace) continue;
      prevSpace = true;
    } else {
      prevSpace = false;
    }
    norm += ch;
    map.push(i);
  }
  return { norm, map };
}

/** Strips an ellipsis the model may put inside a quote and returns the pieces */
export function splitQuote(quote: string): string[] {
  return quote
    .split(/\s*(?:…|\.\.\.)\s*/)
    .map((p) => p.trim().replace(/^["“«]+|["”»]+$/g, "").trim())
    .filter((p) => p.length >= 4);
}

/** Finds a quote in the text: exact match first, then ignoring case, quotes and whitespace */
export function locateQuote(text: string, quote: string): [number, number] | null {
  const q = quote.trim();
  if (!q) return null;
  const exact = text.indexOf(q);
  if (exact >= 0) return [exact, exact + q.length];

  const { norm, map } = normalizeWithMap(text);
  const nq = normalize(q).trim();
  const at = norm.indexOf(nq);
  if (at < 0) return null;
  const start = map[at];
  const end = map[at + nq.length - 1] + 1;
  return [start, end];
}

/** Locates every quote of a finding; a quote with "…" is located piece by piece */
export function locateQuotes(text: string, quotes: string[]): { spans: Array<[number, number]>; exact: boolean } {
  const spans: Array<[number, number]> = [];
  let exact = quotes.length > 0;
  for (const quote of quotes) {
    const pieces = splitQuote(quote);
    if (pieces.length === 0) {
      exact = false;
      continue;
    }
    for (const piece of pieces) {
      const span = locateQuote(text, piece);
      if (span) spans.push(span);
      else exact = false;
    }
  }
  spans.sort((a, b) => a[0] - b[0]);
  return { spans, exact };
}

export function spansOverlap(a: [number, number], b: [number, number]): boolean {
  return a[0] < b[1] && b[0] < a[1];
}
