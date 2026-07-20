import { NextResponse } from "next/server";
import { extractDocumentText } from "@/lib/files/extract-document";
import { getFileExtension } from "@/lib/files/decode-text";
import { MAX_FILE_SIZE } from "@/lib/constants";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Файл не передан" }, { status: 400 });
    }

    if (file.size === 0) {
      return NextResponse.json({ error: "Файл пустой" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "Файл больше 5 МБ" }, { status: 400 });
    }

    const ext = getFileExtension(file.name);

    if (ext === "doc") {
      return NextResponse.json(
        { error: "Формат .doc не поддерживается. Сохраните файл как .docx в Word" },
        { status: 400 }
      );
    }

    if (ext !== "txt" && ext !== "docx") {
      return NextResponse.json(
        { error: "Поддерживаются только файлы .txt и .docx" },
        { status: 400 }
      );
    }

    const buffer = await file.arrayBuffer();
    const text = await extractDocumentText(file.name, buffer);
    const trimmed = text.trim();

    if (!trimmed) {
      return NextResponse.json(
        { error: "Не удалось извлечь текст из файла" },
        { status: 400 }
      );
    }

    return NextResponse.json({ text: trimmed });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[read-document]", error);
    }

    const message =
      error instanceof Error && error.message === "unsupported_format"
        ? "Поддерживаются только файлы .txt и .docx"
        : "Не удалось прочитать файл. Убедитесь, что это корректный .docx";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
