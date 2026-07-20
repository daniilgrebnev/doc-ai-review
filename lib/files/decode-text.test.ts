import { describe, expect, it } from "vitest";
import { decodeTextBuffer, getFileExtension } from "@/lib/files/decode-text";

describe("getFileExtension", () => {
  it("returns lowercase extension", () => {
    expect(getFileExtension("Contract.DOCX")).toBe("docx");
    expect(getFileExtension("file.txt")).toBe("txt");
  });
});

describe("decodeTextBuffer", () => {
  it("decodes utf-8 text", () => {
    const buffer = new TextEncoder().encode("Договор поставки").buffer;
    expect(decodeTextBuffer(buffer)).toBe("Договор поставки");
  });
});
