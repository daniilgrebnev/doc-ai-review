import mammoth from "mammoth";
import { Buffer } from "node:buffer";
import { decodeTextBuffer, getFileExtension } from "@/lib/files/decode-text";

export async function extractDocxText(arrayBuffer: ArrayBuffer): Promise<string> {
  const result = await mammoth.extractRawText({
    buffer: Buffer.from(arrayBuffer),
  });
  return result.value;
}

export async function extractDocumentText(
  fileName: string,
  arrayBuffer: ArrayBuffer
): Promise<string> {
  const ext = getFileExtension(fileName);

  if (ext === "txt") {
    return decodeTextBuffer(arrayBuffer);
  }

  if (ext === "docx") {
    return extractDocxText(arrayBuffer);
  }

  throw new Error("unsupported_format");
}
