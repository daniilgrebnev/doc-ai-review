function looksBrokenUtf8(text: string): boolean {
  if (!text.trim()) return true;
  const replacementCount = (text.match(/\uFFFD/g) ?? []).length;
  return replacementCount > text.length * 0.01;
}

export function decodeTextBuffer(buffer: ArrayBuffer): string {
  const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(buffer);

  if (!looksBrokenUtf8(utf8)) {
    return utf8;
  }

  try {
    const cp1251 = new TextDecoder("windows-1251").decode(buffer);
    if (cp1251.trim()) return cp1251;
  } catch {
    // ignore unsupported encoding
  }

  return utf8;
}

export function getFileExtension(name: string): string {
  const parts = name.split(".");
  return parts.length > 1 ? (parts.pop()?.toLowerCase() ?? "") : "";
}
