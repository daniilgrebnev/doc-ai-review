import { getFileExtension } from "@/lib/files/decode-text";

export async function readDocumentFile(file: File): Promise<string> {
  const ext = getFileExtension(file.name);

  if (ext !== "txt" && ext !== "docx" && ext !== "doc") {
    throw new Error("Поддерживаются только файлы .txt и .docx");
  }

  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/read-document", {
    method: "POST",
    body: formData,
  });

  const data = (await response.json()) as { text?: string; error?: string };

  if (!response.ok) {
    throw new Error(data.error ?? "Не удалось прочитать файл");
  }

  if (!data.text?.trim()) {
    throw new Error("Файл пустой или не содержит текста");
  }

  return data.text;
}
