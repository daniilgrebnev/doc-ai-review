export interface TextPatch {
  find: string;
  replace: string;
}

function extractJsonArray(text: string): string | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const source = fenced ? fenced[1].trim() : text.trim();
  const match = source.match(/\[[\s\S]*\]/);
  return match ? match[0] : null;
}

export function parseTextPatches(rawText: string): TextPatch[] {
  const jsonStr = extractJsonArray(rawText);
  if (!jsonStr) return [];

  try {
    const parsed = JSON.parse(jsonStr) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(
        (item): item is TextPatch =>
          typeof item === "object" &&
          item !== null &&
          typeof (item as TextPatch).find === "string" &&
          typeof (item as TextPatch).replace === "string" &&
          (item as TextPatch).find.trim().length > 0
      )
      .map((item) => ({
        find: item.find.trim(),
        replace: item.replace.trim(),
      }));
  } catch {
    return [];
  }
}

export function applyTextPatches(document: string, patches: TextPatch[]): {
  text: string;
  applied: number;
} {
  let result = document;
  let applied = 0;

  for (const patch of patches) {
    if (!result.includes(patch.find)) continue;
    result = result.replace(patch.find, patch.replace);
    applied += 1;
  }

  return { text: result, applied };
}
